import {
  hotelRoutes,
  type AuthenticatedPrincipal,
  type HotelFacilityListQuery,
} from "@werehere/contracts";
import type {
  FacilityEntity,
  FacilityMutationValue,
  FacilityRepository,
} from "@werehere/db";
import { sha256 } from "../auth/crypto";

type MutationPrincipal = AuthenticatedPrincipal & { sessionToken: string };
export class FacilityServiceError extends Error {
  constructor(
    public readonly code: "DB_NOT_CONFIGURED" | "INTERNAL_ERROR",
    public readonly httpStatus: 500 | 503,
    public readonly retryable: boolean,
  ) {
    super(code);
  }
}
export interface FacilityService {
  close?(): Promise<void>;
  getResource(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    entity: FacilityEntity,
    resourceId: string,
  ): ReturnType<FacilityRepository["getResource"]>;
  getWorkspace(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    query: HotelFacilityListQuery,
  ): ReturnType<FacilityRepository["getWorkspace"]>;
  mutate(
    principal: MutationPrincipal,
    hotelId: string,
    entity: FacilityEntity,
    action: "CREATE" | "UPDATE" | "STATUS" | "DELETE",
    resourceId: string | null,
    value: FacilityMutationValue,
    idempotencyKey: string,
  ): ReturnType<FacilityRepository["mutate"]>;
}
const actor = (principal: AuthenticatedPrincipal) => ({
  companyId: principal.companyId,
  sessionId: principal.sessionId,
  userId: principal.userId,
  userType: principal.userType,
});
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
function path(
  hotelId: string,
  entity: FacilityEntity,
  action: string,
  id: string,
) {
  const base =
    entity === "COMMON_AREA"
      ? hotelRoutes.commonAreas(hotelId)
      : entity === "FACILITY_TYPE"
        ? hotelRoutes.facilityTypes(hotelId)
        : hotelRoutes.facilities(hotelId);
  if (action === "CREATE") return base;
  const detail =
    entity === "COMMON_AREA"
      ? hotelRoutes.commonArea(hotelId, id)
      : entity === "FACILITY_TYPE"
        ? hotelRoutes.facilityType(hotelId, id)
        : hotelRoutes.facility(hotelId, id);
  return action === "STATUS"
    ? `${detail}/status`
    : action === "DELETE"
      ? `${detail}/delete`
      : detail;
}
export function createFacilityService(
  repository: FacilityRepository,
): FacilityService {
  return {
    close() {
      return repository.close();
    },
    getResource(principal, hotelId, entity, resourceId) {
      return repository.getResource(
        actor(principal),
        hotelId,
        entity,
        resourceId,
      );
    },
    getWorkspace(principal, hotelId, query) {
      return repository.getWorkspace(actor(principal), hotelId, query);
    },
    async mutate(
      principal,
      hotelId,
      entity,
      action,
      resourceId,
      value,
      idempotencyKey,
    ) {
      const id = resourceId ?? crypto.randomUUID();
      const httpMethod = action === "UPDATE" ? "PATCH" : "POST";
      const operationPath = path(hotelId, entity, action, id);
      return repository.mutate({
        actor: actor(principal),
        auditEventId: crypto.randomUUID(),
        entity,
        action,
        expectedVersion: "version" in value ? value.version : null,
        historyId: crypto.randomUUID(),
        hotelId,
        httpMethod,
        idempotencyKey,
        idempotencyRecordId: crypto.randomUUID(),
        operationPath,
        requestHash: hex(
          await sha256(
            JSON.stringify({
              method: httpMethod,
              path: operationPath,
              body: value,
            }),
          ),
        ),
        resourceId: id,
        sessionToken: principal.sessionToken,
        traceId: crypto.randomUUID(),
        value,
      });
    },
  };
}
