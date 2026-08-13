import {
  confirmDailySalesRequestSchema,
  correctDailySalesRequestSchema,
  createDailySalesDraftRequestSchema,
  dailySalesCapabilitiesResponseSchema,
  dailySalesInternalResponseSchema,
  dailySalesListQuerySchema,
  dailySalesListResponseSchema,
  dailySalesOwnerResponseSchema,
  dailySalesReferenceResponseSchema,
  dailySalesRoutes,
  updateDailySalesDraftRequestSchema,
  type AuthenticatedPrincipal,
  type DailySales,
  type HotelErrorCode,
} from "@werehere/contracts";
import type {
  DailySalesCommandInput,
  DailySalesRepository,
} from "@werehere/db";
import { sha256 } from "../auth/crypto";

type MutationPrincipal = AuthenticatedPrincipal & { sessionToken: string };
type DailySalesHttpStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503;

export class DailySalesServiceError extends Error {
  readonly retryable = false;
  constructor(
    public readonly code: HotelErrorCode,
    public readonly httpStatus: DailySalesHttpStatus,
  ) {
    super(code);
  }
}

const STATUS: Record<string, [HotelErrorCode, DailySalesHttpStatus]> = {
  FORBIDDEN: ["FORBIDDEN", 403],
  HOTEL_SALES_DUPLICATE_DATE: ["HOTEL_SALES_DUPLICATE_DATE", 409],
  HOTEL_SALES_EVIDENCE_REQUIRED: ["HOTEL_SALES_EVIDENCE_REQUIRED", 422],
  HOTEL_SALES_LOCKED: ["HOTEL_SALES_LOCKED", 409],
  HOTEL_SALES_TOTAL_MISMATCH: ["HOTEL_SALES_TOTAL_MISMATCH", 422],
  IDEMPOTENCY_CONFLICT: ["IDEMPOTENCY_CONFLICT", 409],
  NOT_FOUND: ["RESOURCE_NOT_FOUND", 404],
  VALIDATION_ERROR: ["VALIDATION_ERROR", 400],
  VERSION_CONFLICT: ["VERSION_CONFLICT", 409],
};

function failure(status: string): never {
  const mapped = STATUS[status] ?? ["INTERNAL_ERROR", 500];
  throw new DailySalesServiceError(mapped[0], mapped[1]);
}

function requirePrincipal(principal: AuthenticatedPrincipal): MutationPrincipal {
  if (
    !("sessionToken" in principal) ||
    typeof (principal as { sessionToken?: unknown }).sessionToken !== "string"
  )
    throw new DailySalesServiceError("AUTHENTICATION_REQUIRED", 401);
  return principal as MutationPrincipal;
}

async function requestHash(value: unknown) {
  const digest = await sha256(JSON.stringify(value));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export interface DailySalesService {
  capabilities(principal: AuthenticatedPrincipal): Promise<unknown>;
  close?(): Promise<void>;
  confirm(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    salesId: string,
    value: unknown,
    idempotencyKey: string,
  ): Promise<unknown>;
  correct(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    salesId: string,
    value: unknown,
    idempotencyKey: string,
  ): Promise<unknown>;
  create(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    value: unknown,
    idempotencyKey: string,
  ): Promise<DailySales>;
  get(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    salesId: string,
  ): Promise<unknown>;
  list(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    query: unknown,
  ): Promise<unknown>;
  references(
    principal: AuthenticatedPrincipal,
    hotelId: string,
  ): Promise<unknown>;
  update(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    salesId: string,
    value: unknown,
    idempotencyKey: string,
  ): Promise<unknown>;
}

export function createDailySalesService(
  repository: DailySalesRepository,
): DailySalesService {
  function parseDetail(value: unknown) {
    const internal = dailySalesInternalResponseSchema.safeParse({
      data: { sales: value },
      error: null,
      ok: true,
    });
    if (internal.success) return internal.data.data.sales;
    const owner = dailySalesOwnerResponseSchema.safeParse({
      data: { sales: value },
      error: null,
      ok: true,
    });
    if (owner.success) return owner.data.data.sales;
    throw new DailySalesServiceError("INTERNAL_ERROR", 500);
  }

  async function mutation(
    principal: AuthenticatedPrincipal,
    input: Omit<
      DailySalesCommandInput,
      | "auditEventId"
      | "companyId"
      | "idempotencyRecordId"
      | "requestHash"
      | "sessionId"
      | "sessionToken"
      | "traceId"
    >,
  ) {
    const actor = requirePrincipal(principal);
    const command: DailySalesCommandInput = {
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
    return parseDetail(result.payload);
  }

  return {
    async capabilities(principal) {
      const actor = requirePrincipal(principal);
      const result = await repository.capabilities({
        companyId: actor.companyId,
        sessionId: actor.sessionId,
        sessionToken: actor.sessionToken,
      });
      if (result.status !== "OK" || result.payload === null)
        failure(result.status);
      const parsed = dailySalesCapabilitiesResponseSchema.safeParse({
        data: result.payload,
        error: null,
        ok: true,
      });
      if (!parsed.success) throw new DailySalesServiceError("INTERNAL_ERROR", 500);
      return parsed.data.data;
    },
    async close() {
      await repository.close();
    },
    async confirm(principal, hotelId, salesId, value, idempotencyKey) {
      const parsed = confirmDailySalesRequestSchema.parse(value);
      return mutation(principal, {
        action: "CONFIRM",
        expectedVersion: parsed.version,
        hotelId,
        idempotencyKey,
        method: "POST",
        operationPath: dailySalesRoutes.confirm(hotelId, salesId),
        resourceId: salesId,
        value: parsed,
      });
    },
    async correct(principal, hotelId, salesId, value, idempotencyKey) {
      const parsed = correctDailySalesRequestSchema.parse(value);
      return mutation(principal, {
        action: "CORRECT",
        expectedVersion: parsed.version,
        hotelId,
        idempotencyKey,
        method: "POST",
        operationPath: dailySalesRoutes.corrections(hotelId, salesId),
        resourceId: salesId,
        value: parsed,
      });
    },
    async create(principal, hotelId, value, idempotencyKey) {
      const parsed = createDailySalesDraftRequestSchema.parse(value);
      return mutation(principal, {
        action: "CREATE",
        expectedVersion: 0,
        hotelId,
        idempotencyKey,
        method: "POST",
        operationPath: dailySalesRoutes.create(hotelId),
        resourceId: parsed.salesId,
        value: parsed,
      }) as Promise<DailySales>;
    },
    async get(principal, hotelId, salesId) {
      const actor = requirePrincipal(principal);
      const result = await repository.read({
        companyId: actor.companyId,
        hotelId,
        query: {},
        salesId,
        sessionId: actor.sessionId,
        sessionToken: actor.sessionToken,
      });
      if (result.status !== "OK" || result.payload === null)
        failure(result.status);
      return parseDetail(result.payload);
    },
    async list(principal, hotelId, query) {
      const actor = requirePrincipal(principal);
      const parsedQuery = dailySalesListQuerySchema.parse(query);
      const result = await repository.read({
        companyId: actor.companyId,
        hotelId,
        query: parsedQuery,
        salesId: null,
        sessionId: actor.sessionId,
        sessionToken: actor.sessionToken,
      });
      if (result.status !== "OK" || result.payload === null)
        failure(result.status);
      const parsed = dailySalesListResponseSchema.safeParse({
        data: result.payload,
        error: null,
        ok: true,
      });
      if (!parsed.success) throw new DailySalesServiceError("INTERNAL_ERROR", 500);
      return parsed.data.data;
    },
    async references(principal, hotelId) {
      const actor = requirePrincipal(principal);
      const result = await repository.read({
        companyId: actor.companyId,
        hotelId,
        query: { references: true },
        salesId: null,
        sessionId: actor.sessionId,
        sessionToken: actor.sessionToken,
      });
      if (result.status !== "OK" || result.payload === null)
        failure(result.status);
      const parsed = dailySalesReferenceResponseSchema.safeParse({
        data: result.payload,
        error: null,
        ok: true,
      });
      if (!parsed.success) throw new DailySalesServiceError("INTERNAL_ERROR", 500);
      return parsed.data.data;
    },
    async update(principal, hotelId, salesId, value, idempotencyKey) {
      const parsed = updateDailySalesDraftRequestSchema.parse(value);
      return mutation(principal, {
        action: "UPDATE",
        expectedVersion: parsed.version,
        hotelId,
        idempotencyKey,
        method: "PATCH",
        operationPath: dailySalesRoutes.update(hotelId, salesId),
        resourceId: salesId,
        value: parsed,
      });
    },
  };
}
