import {
  createOperationalIssueRequestSchema,
  operationalIssueActionRequestSchema,
  operationalIssueAddEntryRequestSchema,
  operationalIssueAssigneeRequestSchema,
  operationalIssueCapabilitiesResponseSchema,
  operationalIssueInternalResponseSchema,
  operationalIssueListQuerySchema,
  operationalIssueListResponseSchema,
  operationalIssueOwnerResponseSchema,
  operationalIssueRoutes,
  type AuthenticatedPrincipal,
  type HotelErrorCode,
  type OperationalIssue,
} from "@werehere/contracts";
import type {
  OperationalIssueCommandInput,
  OperationalIssueRepository,
} from "@werehere/db";
import { sha256 } from "../auth/crypto";

type MutationPrincipal = AuthenticatedPrincipal & { sessionToken: string };
type IssueHttpStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503;

export class OperationalIssueServiceError extends Error {
  readonly retryable = false;
  constructor(
    public readonly code: HotelErrorCode,
    public readonly httpStatus: IssueHttpStatus,
  ) {
    super(code);
  }
}

const STATUS: Record<string, [HotelErrorCode, IssueHttpStatus]> = {
  FORBIDDEN: ["FORBIDDEN", 403],
  IDEMPOTENCY_CONFLICT: ["IDEMPOTENCY_CONFLICT", 409],
  ISSUE_ASSIGNEE_INVALID: ["ISSUE_ASSIGNEE_INVALID", 422],
  ISSUE_STATE_INVALID: ["ISSUE_STATE_INVALID", 422],
  ISSUE_TERMINAL_LOCKED: ["ISSUE_TERMINAL_LOCKED", 409],
  NOT_FOUND: ["RESOURCE_NOT_FOUND", 404],
  VALIDATION_ERROR: ["VALIDATION_ERROR", 400],
  VERSION_CONFLICT: ["VERSION_CONFLICT", 409],
};

function failure(status: string): never {
  const mapped = STATUS[status] ?? ["INTERNAL_ERROR", 500];
  throw new OperationalIssueServiceError(mapped[0], mapped[1]);
}

function requireMutationPrincipal(
  principal: AuthenticatedPrincipal,
): MutationPrincipal {
  if (
    !("sessionToken" in principal) ||
    typeof (principal as { sessionToken?: unknown }).sessionToken !== "string"
  )
    throw new OperationalIssueServiceError("AUTHENTICATION_REQUIRED", 401);
  return principal as MutationPrincipal;
}

async function requestHash(value: unknown) {
  const digest = await sha256(JSON.stringify(value));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export interface OperationalIssueService {
  capabilities(principal: AuthenticatedPrincipal): Promise<unknown>;
  close?(): Promise<void>;
  addEntry(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    issueId: string,
    kind: "ADD_INTERNAL_NOTE" | "ADD_PUBLIC_COMMENT" | "ADD_WORK_LOG",
    value: unknown,
    idempotencyKey: string,
  ): Promise<unknown>;
  assign(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    issueId: string,
    value: unknown,
    idempotencyKey: string,
  ): Promise<unknown>;
  create(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    value: unknown,
    idempotencyKey: string,
  ): Promise<OperationalIssue>;
  get(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    issueId: string,
  ): Promise<unknown>;
  list(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    query: unknown,
  ): Promise<unknown>;
  transition(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    issueId: string,
    value: unknown,
    idempotencyKey: string,
  ): Promise<unknown>;
}

export function createOperationalIssueService(
  repository: OperationalIssueRepository,
): OperationalIssueService {
  async function mutation(
    principal: AuthenticatedPrincipal,
    input: Omit<
      OperationalIssueCommandInput,
      | "auditEventId"
      | "companyId"
      | "idempotencyRecordId"
      | "requestHash"
      | "sessionId"
      | "sessionToken"
      | "traceId"
    >,
  ) {
    const actor = requireMutationPrincipal(principal);
    const command: OperationalIssueCommandInput = {
      ...input,
      auditEventId: crypto.randomUUID(),
      companyId: actor.companyId,
      idempotencyRecordId: crypto.randomUUID(),
      requestHash: await requestHash({
        method: input.method,
        path: input.operationPath,
        value: input.value,
      }),
      sessionId: actor.sessionId,
      sessionToken: actor.sessionToken,
      traceId: crypto.randomUUID(),
    };
    const result = await repository.command(command);
    if (
      !["CREATED", "REPLAYED", "UPDATED"].includes(result.status) ||
      result.payload === null
    )
      failure(result.status);
    return result.payload;
  }

  function parseDetail(value: unknown) {
    const internal = operationalIssueInternalResponseSchema.safeParse({
      data: { issue: value },
      error: null,
      ok: true,
    });
    if (internal.success) return internal.data.data.issue;
    const owner = operationalIssueOwnerResponseSchema.safeParse({
      data: { issue: value },
      error: null,
      ok: true,
    });
    if (owner.success) return owner.data.data.issue;
    throw new OperationalIssueServiceError("INTERNAL_ERROR", 500);
  }

  return {
    async capabilities(principal) {
      const actor = requireMutationPrincipal(principal);
      const result = await repository.capabilities({
        companyId: actor.companyId,
        sessionId: actor.sessionId,
        sessionToken: actor.sessionToken,
      });
      if (result.status !== "OK" || result.payload === null)
        failure(result.status);
      const parsed = operationalIssueCapabilitiesResponseSchema.safeParse({
        data: result.payload,
        error: null,
        ok: true,
      });
      if (!parsed.success)
        throw new OperationalIssueServiceError("INTERNAL_ERROR", 500);
      return parsed.data.data;
    },
    async close() {
      await repository.close();
    },
    async addEntry(principal, hotelId, issueId, kind, value, idempotencyKey) {
      const parsed = operationalIssueAddEntryRequestSchema.parse(value);
      return parseDetail(
        await mutation(principal, {
          action: kind,
          expectedVersion: parsed.version,
          hotelId,
          idempotencyKey,
          method: "POST",
          operationPath:
            kind === "ADD_WORK_LOG"
              ? operationalIssueRoutes.workLogs(hotelId, issueId)
              : kind === "ADD_PUBLIC_COMMENT"
                ? operationalIssueRoutes.publicComments(hotelId, issueId)
                : operationalIssueRoutes.internalNotes(hotelId, issueId),
          resourceId: issueId,
          value: parsed,
        }),
      );
    },
    async assign(principal, hotelId, issueId, value, idempotencyKey) {
      const parsed = operationalIssueAssigneeRequestSchema.parse(value);
      return parseDetail(
        await mutation(principal, {
          action: "ASSIGN",
          expectedVersion: parsed.version,
          hotelId,
          idempotencyKey,
          method: "POST",
          operationPath: operationalIssueRoutes.assign(hotelId, issueId),
          resourceId: issueId,
          value: parsed,
        }),
      );
    },
    async create(principal, hotelId, value, idempotencyKey) {
      const parsed = createOperationalIssueRequestSchema.parse(value);
      return parseDetail(
        await mutation(principal, {
          action: "CREATE",
          expectedVersion: 0,
          hotelId,
          idempotencyKey,
          method: "POST",
          operationPath: operationalIssueRoutes.create(hotelId),
          resourceId: parsed.issueId,
          value: parsed,
        }),
      ) as OperationalIssue;
    },
    async get(principal, hotelId, issueId) {
      const actor = requireMutationPrincipal(principal);
      const result = await repository.read({
        companyId: actor.companyId,
        hotelId,
        issueId,
        query: {},
        sessionId: actor.sessionId,
        sessionToken: actor.sessionToken,
      });
      if (result.status !== "OK" || result.payload === null)
        failure(result.status);
      return parseDetail(result.payload);
    },
    async list(principal, hotelId, query) {
      const actor = requireMutationPrincipal(principal);
      const parsedQuery = operationalIssueListQuerySchema.parse(query);
      const result = await repository.read({
        companyId: actor.companyId,
        hotelId,
        issueId: null,
        query: parsedQuery,
        sessionId: actor.sessionId,
        sessionToken: actor.sessionToken,
      });
      if (result.status !== "OK" || result.payload === null)
        failure(result.status);
      const parsed = operationalIssueListResponseSchema.safeParse({
        data: result.payload,
        error: null,
        ok: true,
      });
      if (!parsed.success)
        throw new OperationalIssueServiceError("INTERNAL_ERROR", 500);
      return parsed.data.data;
    },
    async transition(principal, hotelId, issueId, value, idempotencyKey) {
      const parsed = operationalIssueActionRequestSchema.parse(value);
      return parseDetail(
        await mutation(principal, {
          action: parsed.action,
          expectedVersion: parsed.version,
          hotelId,
          idempotencyKey,
          method: "POST",
          operationPath: operationalIssueRoutes.transitions(hotelId, issueId),
          resourceId: issueId,
          value: parsed,
        }),
      );
    },
  };
}
