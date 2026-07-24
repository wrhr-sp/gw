import type {
  ActivateHotelRequest,
  AuthenticatedPrincipal,
  CreateHotelAssignmentRequest,
  CreateHotelRequest,
  EndHotelAssignmentRequest,
  HotelBasicInformation,
  HotelListQuery,
  OwnerTransferRequest,
} from "@werehere/contracts";
import type {
  HotelCreateResult,
  HotelListResult,
  HotelRepository,
} from "@werehere/db";
import { sha256 } from "../auth/crypto";

export class HotelServiceError extends Error {
  constructor(
    public readonly code: "DB_NOT_CONFIGURED" | "INTERNAL_ERROR",
    public readonly httpStatus: 500 | 503,
    public readonly retryable: boolean,
  ) {
    super(code);
  }
}

export interface HotelService {
  close?(): Promise<void>;
  createHotel(
    principal: AuthenticatedPrincipal,
    value: CreateHotelRequest,
    idempotencyKey: string,
  ): Promise<HotelCreateResult>;
  getHotel(
    principal: AuthenticatedPrincipal,
    hotelId: string,
  ): Promise<HotelBasicInformation | null>;
  listHotels(
    principal: AuthenticatedPrincipal,
    query: HotelListQuery,
  ): Promise<HotelListResult>;
  listAssignments(
    principal: AuthenticatedPrincipal,
    hotelId: string,
  ): Promise<Awaited<ReturnType<HotelRepository["listAssignments"]>>>;
  createAssignment(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    value: CreateHotelAssignmentRequest,
    idempotencyKey: string,
  ): Promise<Awaited<ReturnType<HotelRepository["createAssignment"]>>>;
  endAssignment(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    assignmentId: string,
    value: EndHotelAssignmentRequest,
    idempotencyKey: string,
  ): Promise<Awaited<ReturnType<HotelRepository["endAssignment"]>>>;
  transferOwner(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    value: OwnerTransferRequest,
    idempotencyKey: string,
  ): Promise<Awaited<ReturnType<HotelRepository["transferOwner"]>>>;
  activateHotel(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    value: ActivateHotelRequest,
    idempotencyKey: string,
  ): Promise<Awaited<ReturnType<HotelRepository["activateHotel"]>>>;
}

function actor(principal: AuthenticatedPrincipal) {
  return {
    companyId: principal.companyId,
    sessionId: principal.sessionId,
    userId: principal.userId,
    userType: principal.userType,
  };
}

async function requestHash(value: unknown): Promise<string> {
  const digest = await sha256(JSON.stringify(value));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function createHotelService(repository: HotelRepository): HotelService {
  return {
    close() {
      return repository.close();
    },

    async createHotel(principal, value, idempotencyKey) {
      let stage = "UUID_GENERATION";
      try {
        const auditEventId = crypto.randomUUID();
        const branchId = crypto.randomUUID();
        const idempotencyRecordId = crypto.randomUUID();
        const traceId = crypto.randomUUID();
        stage = "REQUEST_HASH";
        const hash = await requestHash(value);
        stage = "REPOSITORY_CALL";
        return await repository.createHotel({
          actor: actor(principal),
          auditEventId,
          branchId,
          idempotencyKey,
          idempotencyRecordId,
          operationPath: "/api/hotels",
          requestHash: hash,
          traceId,
          value,
        });
      } catch (error) {
        if (error && typeof error === "object" && !("hotelStage" in error)) {
          Object.defineProperty(error, "hotelStage", { value: stage });
        }
        throw error;
      }
    },

    listAssignments(principal, hotelId) {
      return repository.listAssignments(actor(principal), hotelId, {
        auditEventId: crypto.randomUUID(),
        traceId: crypto.randomUUID(),
      });
    },

    async createAssignment(principal, hotelId, value, idempotencyKey) {
      return repository.createAssignment({
        actor: actor(principal),
        assignmentId: crypto.randomUUID(),
        auditEventId: crypto.randomUUID(),
        hotelId,
        idempotencyKey,
        idempotencyRecordId: crypto.randomUUID(),
        operationPath: `/api/hotels/${hotelId}/assignments`,
        requestHash: await requestHash(value),
        traceId: crypto.randomUUID(),
        value,
      });
    },

    async endAssignment(
      principal,
      hotelId,
      assignmentId,
      value,
      idempotencyKey,
    ) {
      return repository.endAssignment({
        actor: actor(principal),
        assignmentId,
        auditEventId: crypto.randomUUID(),
        hotelId,
        idempotencyKey,
        idempotencyRecordId: crypto.randomUUID(),
        operationPath: `/api/hotels/${hotelId}/assignments/${assignmentId}/end`,
        requestHash: await requestHash(value),
        traceId: crypto.randomUUID(),
        value,
      });
    },

    async transferOwner(principal, hotelId, value, idempotencyKey) {
      return repository.transferOwner({
        actor: actor(principal),
        assignmentId: crypto.randomUUID(),
        auditEventId: crypto.randomUUID(),
        hotelId,
        idempotencyKey,
        idempotencyRecordId: crypto.randomUUID(),
        operationPath: `/api/hotels/${hotelId}/owner-transfer`,
        requestHash: await requestHash(value),
        traceId: crypto.randomUUID(),
        value,
      });
    },

    async activateHotel(principal, hotelId, value, idempotencyKey) {
      return repository.activateHotel({
        actor: actor(principal),
        assignmentId: hotelId,
        auditEventId: crypto.randomUUID(),
        hotelId,
        idempotencyKey,
        idempotencyRecordId: crypto.randomUUID(),
        operationPath: `/api/hotels/${hotelId}/activate`,
        requestHash: await requestHash(value),
        traceId: crypto.randomUUID(),
        value,
      });
    },

    getHotel(principal, hotelId) {
      return repository.getHotel(actor(principal), hotelId, {
        auditEventId: crypto.randomUUID(),
        traceId: crypto.randomUUID(),
      });
    },

    listHotels(principal, query) {
      return repository.listHotels(actor(principal), query, {
        auditEventId: crypto.randomUUID(),
        traceId: crypto.randomUUID(),
      });
    },
  };
}
