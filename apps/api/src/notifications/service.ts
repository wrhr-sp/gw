import {
  hotelNotificationListQuerySchema,
  hotelNotificationListResponseSchema,
  hotelNotificationResponseSchema,
  hotelNotificationRoutes,
  markHotelNotificationReadRequestSchema,
  type AuthenticatedPrincipal,
  type HotelErrorCode,
  type HotelNotification,
} from "@werehere/contracts";
import type {
  NotificationCommandInput,
  NotificationRepository,
} from "@werehere/db";
import { sha256 } from "../auth/crypto";

type Principal = AuthenticatedPrincipal & { sessionToken: string };
type Http = 400 | 401 | 403 | 404 | 409 | 500 | 503;
export class NotificationServiceError extends Error {
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
  NOT_FOUND: ["RESOURCE_NOT_FOUND", 404],
  VALIDATION_ERROR: ["VALIDATION_ERROR", 400],
  VERSION_CONFLICT: ["VERSION_CONFLICT", 409],
};
function failure(status: string): never {
  const mapped = STATUS[status] ?? ["INTERNAL_ERROR", 500];
  throw new NotificationServiceError(mapped[0], mapped[1]);
}
function principal(value: AuthenticatedPrincipal): Principal {
  if (
    !("sessionToken" in value) ||
    typeof (value as { sessionToken?: unknown }).sessionToken !== "string"
  )
    throw new NotificationServiceError("AUTHENTICATION_REQUIRED", 401);
  return value as Principal;
}
async function requestHash(value: unknown) {
  const digest = await sha256(JSON.stringify(value));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export interface NotificationService {
  close?(): Promise<void>;
  list(p: AuthenticatedPrincipal, query: unknown): Promise<unknown>;
  markRead(
    p: AuthenticatedPrincipal,
    notificationId: string,
    value: unknown,
    idempotencyKey: string,
  ): Promise<HotelNotification>;
}

export function createNotificationService(
  repository: NotificationRepository,
): NotificationService {
  return {
    async close() {
      await repository.close();
    },
    async list(p, value) {
      const actor = principal(p);
      const query = hotelNotificationListQuerySchema.parse(value);
      const result = await repository.read({
        companyId: actor.companyId,
        query,
        sessionId: actor.sessionId,
        sessionToken: actor.sessionToken,
      });
      if (result.status !== "OK" || result.payload === null) failure(result.status);
      const parsed = hotelNotificationListResponseSchema.safeParse({
        ok: true,
        data: result.payload,
        error: null,
      });
      if (!parsed.success) throw new NotificationServiceError("INTERNAL_ERROR", 500);
      return parsed.data.data;
    },
    async markRead(p, notificationId, value, idempotencyKey) {
      const actor = principal(p);
      const body = markHotelNotificationReadRequestSchema.parse(value);
      const input: NotificationCommandInput = {
        action: "MARK_READ",
        auditEventId: crypto.randomUUID(),
        companyId: actor.companyId,
        expectedVersion: body.version,
        idempotencyKey,
        idempotencyRecordId: crypto.randomUUID(),
        method: "POST",
        notificationId,
        operationPath: hotelNotificationRoutes.markRead(notificationId),
        requestHash: await requestHash({ notificationId, version: body.version }),
        sessionId: actor.sessionId,
        sessionToken: actor.sessionToken,
        traceId: crypto.randomUUID(),
      };
      const result = await repository.command(input);
      if (
        !["REPLAYED", "UPDATED"].includes(result.status) ||
        result.payload === null
      )
        failure(result.status);
      const parsed = hotelNotificationResponseSchema.safeParse({
        ok: true,
        data: result.payload,
        error: null,
      });
      if (!parsed.success) throw new NotificationServiceError("INTERNAL_ERROR", 500);
      return parsed.data.data.notification;
    },
  };
}
