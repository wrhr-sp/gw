import {
  createKnowledgeEntryRequestSchema,
  knowledgeCapabilitiesResponseSchema,
  knowledgeAttachmentLinkRequestSchema,
  knowledgeEntryResponseSchema,
  knowledgeFeedbackRequestSchema,
  knowledgeFeedbackResponseSchema,
  knowledgeListQuerySchema,
  knowledgeListResponseSchema,
  knowledgeReviewerCandidatesQuerySchema,
  knowledgeReviewerCandidatesResponseSchema,
  knowledgeRoutes,
  knowledgeTransitionRequestSchema,
  updateKnowledgeEntryRequestSchema,
  type AuthenticatedPrincipal,
  type HotelErrorCode,
  type KnowledgeEntry,
} from "@werehere/contracts";
import type {
  KnowledgeCommandInput,
  KnowledgeFeedbackInput,
  KnowledgeRepository,
} from "@werehere/db";
import { sha256 } from "../auth/crypto";

type Principal = AuthenticatedPrincipal & { sessionToken: string };
type HttpStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503;

export class KnowledgeServiceError extends Error {
  readonly retryable = false;
  constructor(
    public readonly code: HotelErrorCode,
    public readonly httpStatus: HttpStatus,
  ) {
    super(code);
  }
}

const STATUS: Record<string, [HotelErrorCode, HttpStatus]> = {
  FORBIDDEN: ["FORBIDDEN", 403],
  IDEMPOTENCY_CONFLICT: ["IDEMPOTENCY_CONFLICT", 409],
  INVALID_STATE_TRANSITION: ["INVALID_STATE_TRANSITION", 409],
  KNOWLEDGE_PERSONAL_DATA_DETECTED: ["KNOWLEDGE_PERSONAL_DATA_DETECTED", 422],
  KNOWLEDGE_REVIEW_REQUIRED: ["KNOWLEDGE_REVIEW_REQUIRED", 409],
  NOT_FOUND: ["RESOURCE_NOT_FOUND", 404],
  VALIDATION_ERROR: ["VALIDATION_ERROR", 400],
  VERSION_CONFLICT: ["VERSION_CONFLICT", 409],
};

function failure(status: string): never {
  const mapped = STATUS[status] ?? ["INTERNAL_ERROR", 500];
  throw new KnowledgeServiceError(mapped[0], mapped[1]);
}

function principal(value: AuthenticatedPrincipal): Principal {
  if (
    !("sessionToken" in value) ||
    typeof (value as { sessionToken?: unknown }).sessionToken !== "string"
  )
    throw new KnowledgeServiceError("AUTHENTICATION_REQUIRED", 401);
  return value as Principal;
}

async function requestHash(value: unknown) {
  const digest = await sha256(JSON.stringify(value));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function parseEntry(value: unknown): KnowledgeEntry {
  const parsed = knowledgeEntryResponseSchema.safeParse({
    data: { entry: value },
    error: null,
    ok: true,
  });
  if (!parsed.success) throw new KnowledgeServiceError("INTERNAL_ERROR", 500);
  return parsed.data.data.entry;
}

export interface KnowledgeService {
  attachments(
    actor: AuthenticatedPrincipal,
    knowledgeId: string,
    value: unknown,
    idempotencyKey: string,
  ): Promise<KnowledgeEntry>;
  capabilities(actor: AuthenticatedPrincipal): Promise<unknown>;
  close?(): Promise<void>;
  create(
    actor: AuthenticatedPrincipal,
    value: unknown,
    idempotencyKey: string,
  ): Promise<KnowledgeEntry>;
  feedback(
    actor: AuthenticatedPrincipal,
    knowledgeId: string,
    value: unknown,
    idempotencyKey: string,
  ): Promise<unknown>;
  get(
    actor: AuthenticatedPrincipal,
    knowledgeId: string,
  ): Promise<KnowledgeEntry>;
  list(actor: AuthenticatedPrincipal, query: unknown): Promise<unknown>;
  reviewerCandidates(
    actor: AuthenticatedPrincipal,
    query: unknown,
  ): Promise<unknown>;
  transition(
    actor: AuthenticatedPrincipal,
    knowledgeId: string,
    value: unknown,
    idempotencyKey: string,
  ): Promise<KnowledgeEntry>;
  update(
    actor: AuthenticatedPrincipal,
    knowledgeId: string,
    value: unknown,
    idempotencyKey: string,
  ): Promise<KnowledgeEntry>;
}

export function createKnowledgeService(
  repository: KnowledgeRepository,
): KnowledgeService {
  async function mutate(
    actorValue: AuthenticatedPrincipal,
    input: Omit<
      KnowledgeCommandInput,
      | "auditEventId"
      | "companyId"
      | "idempotencyRecordId"
      | "requestHash"
      | "sessionId"
      | "sessionToken"
      | "traceId"
    >,
  ) {
    const actor = principal(actorValue);
    const command: KnowledgeCommandInput = {
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
    return parseEntry(result.payload);
  }

  return {
    async attachments(actorValue, knowledgeId, value, idempotencyKey) {
      const actor = principal(actorValue);
      const parsed = knowledgeAttachmentLinkRequestSchema.parse(value);
      const path = knowledgeRoutes.attachments(knowledgeId);
      const result = await repository.attachments({
        auditEventId: crypto.randomUUID(),
        companyId: actor.companyId,
        expectedVersion: parsed.version,
        idempotencyKey,
        idempotencyRecordId: crypto.randomUUID(),
        knowledgeId,
        method: "PUT",
        operationPath: path,
        requestHash: await requestHash({ method: "PUT", path, value: parsed }),
        sessionId: actor.sessionId,
        sessionToken: actor.sessionToken,
        traceId: crypto.randomUUID(),
        value: parsed,
      });
      if (!["REPLAYED", "UPDATED"].includes(result.status) || result.payload === null)
        failure(result.status);
      return parseEntry(result.payload);
    },
    async capabilities(actorValue) {
      const actor = principal(actorValue);
      const result = await repository.capabilities({
        companyId: actor.companyId,
        sessionId: actor.sessionId,
        sessionToken: actor.sessionToken,
      });
      if (result.status !== "OK" || result.payload === null)
        failure(result.status);
      const parsed = knowledgeCapabilitiesResponseSchema.safeParse({
        data: result.payload,
        error: null,
        ok: true,
      });
      if (!parsed.success)
        throw new KnowledgeServiceError("INTERNAL_ERROR", 500);
      return parsed.data.data;
    },
    async close() {
      await repository.close();
    },
    async create(actor, value, idempotencyKey) {
      const parsed = createKnowledgeEntryRequestSchema.parse(value);
      return mutate(actor, {
        action: "CREATE",
        expectedVersion: 0,
        idempotencyKey,
        knowledgeId: parsed.id,
        method: "POST",
        operationPath: knowledgeRoutes.create,
        value: parsed,
      });
    },
    async feedback(actorValue, knowledgeId, value, idempotencyKey) {
      const actor = principal(actorValue);
      const parsedValue = knowledgeFeedbackRequestSchema.parse(value);
      const input: KnowledgeFeedbackInput = {
        auditEventId: crypto.randomUUID(),
        companyId: actor.companyId,
        expectedVersion: parsedValue.version,
        idempotencyKey,
        idempotencyRecordId: crypto.randomUUID(),
        kind: parsedValue.kind,
        knowledgeId,
        method: "POST",
        operationPath: knowledgeRoutes.feedback(knowledgeId),
        requestHash: await requestHash({
          method: "POST",
          path: knowledgeRoutes.feedback(knowledgeId),
          value: parsedValue,
        }),
        sessionId: actor.sessionId,
        sessionToken: actor.sessionToken,
        traceId: crypto.randomUUID(),
        value: parsedValue,
      };
      const result = await repository.feedback(input);
      if (
        !["RECORDED", "REPLAYED"].includes(result.status) ||
        result.payload === null
      )
        failure(result.status);
      const parsed = knowledgeFeedbackResponseSchema.safeParse({
        data: result.payload,
        error: null,
        ok: true,
      });
      if (!parsed.success)
        throw new KnowledgeServiceError("INTERNAL_ERROR", 500);
      return parsed.data.data;
    },
    async get(actorValue, knowledgeId) {
      const actor = principal(actorValue);
      const result = await repository.read({
        companyId: actor.companyId,
        knowledgeId,
        query: {},
        sessionId: actor.sessionId,
        sessionToken: actor.sessionToken,
      });
      if (result.status !== "OK" || result.payload === null)
        failure(result.status);
      return parseEntry(result.payload);
    },
    async list(actorValue, query) {
      const actor = principal(actorValue);
      const parsedQuery = knowledgeListQuerySchema.parse(query);
      const result = await repository.read({
        companyId: actor.companyId,
        knowledgeId: null,
        query: parsedQuery,
        sessionId: actor.sessionId,
        sessionToken: actor.sessionToken,
      });
      if (result.status !== "OK" || result.payload === null)
        failure(result.status);
      const parsed = knowledgeListResponseSchema.safeParse({
        data: result.payload,
        error: null,
        ok: true,
      });
      if (!parsed.success)
        throw new KnowledgeServiceError("INTERNAL_ERROR", 500);
      return parsed.data.data;
    },
    async reviewerCandidates(actorValue, queryValue) {
      const actor = principal(actorValue);
      const query = knowledgeReviewerCandidatesQuerySchema.parse(queryValue);
      const result = await repository.reviewerCandidates({
        branchId: query.hotelId ?? null,
        companyId: actor.companyId,
        sessionId: actor.sessionId,
        sessionToken: actor.sessionToken,
      });
      if (result.status !== "OK" || result.payload === null)
        failure(result.status);
      const parsed = knowledgeReviewerCandidatesResponseSchema.safeParse({
        data: result.payload,
        error: null,
        ok: true,
      });
      if (!parsed.success)
        throw new KnowledgeServiceError("INTERNAL_ERROR", 500);
      return parsed.data.data;
    },
    async transition(actor, knowledgeId, value, idempotencyKey) {
      const parsed = knowledgeTransitionRequestSchema.parse(value);
      return mutate(actor, {
        action: parsed.action,
        expectedVersion: parsed.version,
        idempotencyKey,
        knowledgeId,
        method: "POST",
        operationPath: knowledgeRoutes.transitions(knowledgeId),
        value: parsed,
      });
    },
    async update(actor, knowledgeId, value, idempotencyKey) {
      const parsed = updateKnowledgeEntryRequestSchema.parse(value);
      return mutate(actor, {
        action: "UPDATE",
        expectedVersion: parsed.version,
        idempotencyKey,
        knowledgeId,
        method: "PATCH",
        operationPath: knowledgeRoutes.update(knowledgeId),
        value: parsed,
      });
    },
  };
}
