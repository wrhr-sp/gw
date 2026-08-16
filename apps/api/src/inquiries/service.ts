import {
  createHotelInquiryRequestSchema,
  hotelInquiryAssignRequestSchema,
  hotelInquiryCapabilitiesResponseSchema,
  hotelInquiryCategoryCodeSchema,
  hotelInquiryContactResponseSchema,
  hotelInquiryInternalResponseSchema,
  hotelInquiryListQuerySchema,
  hotelInquiryListResponseSchema,
  hotelInquiryMessageRequestSchema,
  hotelInquiryOwnerResponseSchema,
  hotelInquiryRoutes,
  hotelInquirySettingsResponseSchema,
  hotelInquiryTransitionRequestSchema,
  updateHotelInquiryContactRequestSchema,
  updateHotelInquiryRouteRequestSchema,
  type AuthenticatedPrincipal,
  type HotelErrorCode,
  type HotelInquiry,
  type HotelInquiryPublic,
} from "@werehere/contracts";
import type { InquiryCommandInput, InquiryRepository } from "@werehere/db";
import { sha256 } from "../auth/crypto";
type Principal = AuthenticatedPrincipal & { sessionToken: string };
type Http = 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503;
export class InquiryServiceError extends Error {
  readonly retryable = false;
  constructor(
    public readonly code: HotelErrorCode,
    public readonly httpStatus: Http,
  ) {
    super(code);
  }
}
const STATUS: Record<string, [HotelErrorCode, Http]> = {
  FORBIDDEN: ["FORBIDDEN", 403],
  IDEMPOTENCY_CONFLICT: ["IDEMPOTENCY_CONFLICT", 409],
  INQUIRY_ASSIGNEE_INVALID: ["INQUIRY_ASSIGNEE_INVALID", 422],
  INQUIRY_STATE_INVALID: ["INQUIRY_STATE_INVALID", 422],
  INQUIRY_REOPEN_EXPIRED: ["INQUIRY_REOPEN_EXPIRED", 409],
  INQUIRY_TERMINAL_LOCKED: ["INQUIRY_TERMINAL_LOCKED", 409],
  NOT_FOUND: ["RESOURCE_NOT_FOUND", 404],
  VALIDATION_ERROR: ["VALIDATION_ERROR", 400],
  VERSION_CONFLICT: ["VERSION_CONFLICT", 409],
};
function failure(status: string): never {
  const mapped = STATUS[status] ?? ["INTERNAL_ERROR", 500];
  throw new InquiryServiceError(mapped[0], mapped[1]);
}
function principal(value: AuthenticatedPrincipal): Principal {
  if (
    !("sessionToken" in value) ||
    typeof (value as { sessionToken?: unknown }).sessionToken !== "string"
  )
    throw new InquiryServiceError("AUTHENTICATION_REQUIRED", 401);
  return value as Principal;
}
async function hash(value: unknown) {
  const digest = await sha256(JSON.stringify(value));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}
export interface InquiryService {
  capabilities(p: AuthenticatedPrincipal): Promise<unknown>;
  contact(p: AuthenticatedPrincipal, h: string): Promise<unknown>;
  close?(): Promise<void>;
  create(
    p: AuthenticatedPrincipal,
    h: string,
    v: unknown,
    k: string,
  ): Promise<HotelInquiry | HotelInquiryPublic>;
  get(p: AuthenticatedPrincipal, h: string, i: string): Promise<unknown>;
  list(p: AuthenticatedPrincipal, h: string, q: unknown): Promise<unknown>;
  message(
    p: AuthenticatedPrincipal,
    h: string,
    i: string,
    v: unknown,
    k: string,
  ): Promise<unknown>;
  assign(
    p: AuthenticatedPrincipal,
    h: string,
    i: string,
    v: unknown,
    k: string,
  ): Promise<unknown>;
  transition(
    p: AuthenticatedPrincipal,
    h: string,
    i: string,
    v: unknown,
    k: string,
  ): Promise<unknown>;
  settings(p: AuthenticatedPrincipal, h: string): Promise<unknown>;
  updateContact(
    p: AuthenticatedPrincipal,
    h: string,
    v: unknown,
    k: string,
  ): Promise<unknown>;
  updateRoute(
    p: AuthenticatedPrincipal,
    h: string,
    c: string,
    v: unknown,
    k: string,
  ): Promise<unknown>;
}
export function createInquiryService(
  repository: InquiryRepository,
): InquiryService {
  async function mutation(
    p: AuthenticatedPrincipal,
    input: Omit<
      InquiryCommandInput,
      | "auditEventId"
      | "companyId"
      | "idempotencyRecordId"
      | "requestHash"
      | "sessionId"
      | "sessionToken"
      | "traceId"
    >,
  ) {
    const actor = principal(p);
    const command: InquiryCommandInput = {
      ...input,
      auditEventId: crypto.randomUUID(),
      companyId: actor.companyId,
      idempotencyRecordId: crypto.randomUUID(),
      requestHash: await hash({
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
  function detail(value: unknown) {
    const internal = hotelInquiryInternalResponseSchema.safeParse({
      ok: true,
      data: { inquiry: value },
      error: null,
    });
    if (internal.success) return internal.data.data.inquiry;
    const owner = hotelInquiryOwnerResponseSchema.safeParse({
      ok: true,
      data: { inquiry: value },
      error: null,
    });
    if (owner.success) return owner.data.data.inquiry;
    throw new InquiryServiceError("INTERNAL_ERROR", 500);
  }
  return {
    async capabilities(p) {
      const a = principal(p);
      const r = await repository.capabilities({
        companyId: a.companyId,
        sessionId: a.sessionId,
        sessionToken: a.sessionToken,
      });
      if (r.status !== "OK" || r.payload === null) failure(r.status);
      const parsed = hotelInquiryCapabilitiesResponseSchema.safeParse({
        ok: true,
        data: r.payload,
        error: null,
      });
      if (!parsed.success) throw new InquiryServiceError("INTERNAL_ERROR", 500);
      return parsed.data.data;
    },
    async contact(p, h) {
      const a = principal(p);
      const r = await repository.read({
        companyId: a.companyId,
        hotelId: h,
        inquiryId: null,
        query: { mode: "CONTACT" },
        sessionId: a.sessionId,
        sessionToken: a.sessionToken,
      });
      if (r.status !== "OK" || r.payload === null) failure(r.status);
      const parsed = hotelInquiryContactResponseSchema.safeParse({
        ok: true,
        data: r.payload,
        error: null,
      });
      if (!parsed.success) throw new InquiryServiceError("INTERNAL_ERROR", 500);
      return parsed.data.data;
    },
    async close() {
      await repository.close();
    },
    async create(p, h, v, k) {
      const x = createHotelInquiryRequestSchema.parse(v);
      return detail(
        await mutation(p, {
          action: "CREATE",
          expectedVersion: 0,
          hotelId: h,
          idempotencyKey: k,
          method: "POST",
          operationPath: hotelInquiryRoutes.create(h),
          resourceId: x.inquiryId,
          value: x,
        }),
      ) as HotelInquiry | HotelInquiryPublic;
    },
    async get(p, h, i) {
      const a = principal(p);
      const r = await repository.read({
        companyId: a.companyId,
        hotelId: h,
        inquiryId: i,
        query: {},
        sessionId: a.sessionId,
        sessionToken: a.sessionToken,
      });
      if (r.status !== "OK" || r.payload === null) failure(r.status);
      return detail(r.payload);
    },
    async list(p, h, q) {
      const a = principal(p),
        query = hotelInquiryListQuerySchema.parse(q);
      const r = await repository.read({
        companyId: a.companyId,
        hotelId: h,
        inquiryId: null,
        query,
        sessionId: a.sessionId,
        sessionToken: a.sessionToken,
      });
      if (r.status !== "OK" || r.payload === null) failure(r.status);
      const parsed = hotelInquiryListResponseSchema.safeParse({
        ok: true,
        data: r.payload,
        error: null,
      });
      if (!parsed.success) throw new InquiryServiceError("INTERNAL_ERROR", 500);
      return parsed.data.data;
    },
    async message(p, h, i, v, k) {
      const x = hotelInquiryMessageRequestSchema.parse(v);
      return detail(
        await mutation(p, {
          action:
            x.visibility === "INTERNAL"
              ? "ADD_INTERNAL_MESSAGE"
              : "ADD_PUBLIC_MESSAGE",
          expectedVersion: x.version,
          hotelId: h,
          idempotencyKey: k,
          method: "POST",
          operationPath: hotelInquiryRoutes.messages(h, i),
          resourceId: i,
          value: x,
        }),
      );
    },
    async assign(p, h, i, v, k) {
      const x = hotelInquiryAssignRequestSchema.parse(v);
      return detail(
        await mutation(p, {
          action: "ASSIGN",
          expectedVersion: x.version,
          hotelId: h,
          idempotencyKey: k,
          method: "POST",
          operationPath: hotelInquiryRoutes.assign(h, i),
          resourceId: i,
          value: x,
        }),
      );
    },
    async transition(p, h, i, v, k) {
      const x = hotelInquiryTransitionRequestSchema.parse(v);
      return detail(
        await mutation(p, {
          action: x.action,
          expectedVersion: x.version,
          hotelId: h,
          idempotencyKey: k,
          method: "POST",
          operationPath: hotelInquiryRoutes.transitions(h, i),
          resourceId: i,
          value: x,
        }),
      );
    },
    async settings(p, h) {
      const a = principal(p),
        r = await repository.read({
          companyId: a.companyId,
          hotelId: h,
          inquiryId: null,
          query: { mode: "SETTINGS" },
          sessionId: a.sessionId,
          sessionToken: a.sessionToken,
        });
      if (r.status !== "OK" || r.payload === null) failure(r.status);
      const parsed = hotelInquirySettingsResponseSchema.safeParse({
        ok: true,
        data: r.payload,
        error: null,
      });
      if (!parsed.success) throw new InquiryServiceError("INTERNAL_ERROR", 500);
      return parsed.data.data;
    },
    async updateContact(p, h, v, k) {
      const x = updateHotelInquiryContactRequestSchema.parse(v),
        payload = await mutation(p, {
          action: "UPDATE_CONTACT",
          expectedVersion: x.version,
          hotelId: h,
          idempotencyKey: k,
          method: "PUT",
          operationPath: hotelInquiryRoutes.settingsContact(h),
          resourceId: h,
          value: x,
        });
      const parsed = hotelInquiryContactResponseSchema.safeParse({
        ok: true,
        data: payload,
        error: null,
      });
      if (!parsed.success) throw new InquiryServiceError("INTERNAL_ERROR", 500);
      return parsed.data.data;
    },
    async updateRoute(p, h, c, v, k) {
      const categoryCode = hotelInquiryCategoryCodeSchema.parse(c),
        x = updateHotelInquiryRouteRequestSchema.parse(v);
      const payload = await mutation(p, {
        action: "UPSERT_ROUTE",
        expectedVersion: x.version,
        hotelId: h,
        idempotencyKey: k,
        method: "PUT",
        operationPath: hotelInquiryRoutes.settingsRoute(h, categoryCode),
        resourceId: h,
        value: { ...x, categoryCode },
      });
      const parsed = hotelInquirySettingsResponseSchema.safeParse({
        ok: true,
        data: payload,
        error: null,
      });
      if (!parsed.success) throw new InquiryServiceError("INTERNAL_ERROR", 500);
      return parsed.data.data;
    },
  };
}
