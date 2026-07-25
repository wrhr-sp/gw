import {
  hotelRoutes,
  type AuthenticatedPrincipal,
  type ChangeHotelRoomStatusRequest,
  type CreateHotelRoomRequest,
  type CreateHotelRoomTypeRequest,
  type HotelRoomListQuery,
  type UpdateHotelRoomRequest,
  type UpdateHotelRoomTypeRequest,
} from "@werehere/contracts";
import type { RoomRepository } from "@werehere/db";
import { sha256 } from "../auth/crypto";

export class RoomServiceError extends Error {
  constructor(
    public readonly code: "DB_NOT_CONFIGURED" | "INTERNAL_ERROR",
    public readonly httpStatus: 500 | 503,
    public readonly retryable: boolean,
  ) {
    super(code);
  }
}

export interface RoomService {
  close?(): Promise<void>;
  listRoomTypes(
    principal: AuthenticatedPrincipal,
    hotelId: string,
  ): ReturnType<RoomRepository["listRoomTypes"]>;
  createRoomType(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    value: CreateHotelRoomTypeRequest,
    idempotencyKey: string,
  ): ReturnType<RoomRepository["createRoomType"]>;
  updateRoomType(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    roomTypeId: string,
    value: UpdateHotelRoomTypeRequest,
    idempotencyKey: string,
  ): ReturnType<RoomRepository["updateRoomType"]>;
  listRooms(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    query: HotelRoomListQuery,
  ): ReturnType<RoomRepository["listRooms"]>;
  getRoom(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    roomId: string,
  ): ReturnType<RoomRepository["getRoom"]>;
  createRoom(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    value: CreateHotelRoomRequest,
    idempotencyKey: string,
  ): ReturnType<RoomRepository["createRoom"]>;
  updateRoom(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    roomId: string,
    value: UpdateHotelRoomRequest,
    idempotencyKey: string,
  ): ReturnType<RoomRepository["updateRoom"]>;
  changeRoomStatus(
    principal: AuthenticatedPrincipal,
    hotelId: string,
    roomId: string,
    value: ChangeHotelRoomStatusRequest,
    idempotencyKey: string,
  ): ReturnType<RoomRepository["changeRoomStatus"]>;
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

function mutationIdentity(
  principal: AuthenticatedPrincipal,
  hotelId: string,
  idempotencyKey: string,
  httpMethod: "PATCH" | "POST",
  operationPath: string,
) {
  return {
    actor: actor(principal),
    auditEventId: crypto.randomUUID(),
    hotelId,
    httpMethod,
    idempotencyKey,
    idempotencyRecordId: crypto.randomUUID(),
    operationPath,
    traceId: crypto.randomUUID(),
  };
}

export function createRoomService(repository: RoomRepository): RoomService {
  return {
    close() {
      return repository.close();
    },
    listRoomTypes(principal, hotelId) {
      return repository.listRoomTypes(actor(principal), hotelId);
    },
    async createRoomType(principal, hotelId, value, idempotencyKey) {
      return repository.createRoomType({
        ...mutationIdentity(
          principal,
          hotelId,
          idempotencyKey,
          "POST",
          hotelRoutes.roomTypes(hotelId),
        ),
        requestHash: await requestHash(value),
        roomTypeId: crypto.randomUUID(),
        value,
      });
    },
    async updateRoomType(
      principal,
      hotelId,
      roomTypeId,
      value,
      idempotencyKey,
    ) {
      return repository.updateRoomType({
        ...mutationIdentity(
          principal,
          hotelId,
          idempotencyKey,
          "PATCH",
          hotelRoutes.roomType(hotelId, roomTypeId),
        ),
        requestHash: await requestHash(value),
        roomTypeId,
        value,
      });
    },
    listRooms(principal, hotelId, query) {
      return repository.listRooms(actor(principal), hotelId, query);
    },
    getRoom(principal, hotelId, roomId) {
      return repository.getRoom(actor(principal), hotelId, roomId);
    },
    async createRoom(principal, hotelId, value, idempotencyKey) {
      return repository.createRoom({
        ...mutationIdentity(
          principal,
          hotelId,
          idempotencyKey,
          "POST",
          hotelRoutes.rooms(hotelId),
        ),
        requestHash: await requestHash(value),
        roomId: crypto.randomUUID(),
        value,
      });
    },
    async updateRoom(principal, hotelId, roomId, value, idempotencyKey) {
      return repository.updateRoom({
        ...mutationIdentity(
          principal,
          hotelId,
          idempotencyKey,
          "PATCH",
          hotelRoutes.room(hotelId, roomId),
        ),
        requestHash: await requestHash(value),
        roomId,
        value,
      });
    },
    async changeRoomStatus(principal, hotelId, roomId, value, idempotencyKey) {
      return repository.changeRoomStatus({
        ...mutationIdentity(
          principal,
          hotelId,
          idempotencyKey,
          "POST",
          hotelRoutes.roomStatus(hotelId, roomId),
        ),
        historyId: crypto.randomUUID(),
        requestHash: await requestHash(value),
        roomId,
        value,
      });
    },
  };
}
