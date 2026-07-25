import type {
  AuthenticatedPrincipal,
  HotelRoomInternal,
  HotelRoomOwner,
  HotelRoomType,
} from "@werehere/contracts";
import { describe, expect, it, vi } from "vitest";
import type { RoomRepository } from "@werehere/db";
import { createApp } from "../src/app";
import type { AuthService } from "../src/auth/service";
import { createRoomService, type RoomService } from "../src/rooms/service";

const hotelId = "50000000-0000-4000-8000-000000000001";
const roomId = "52000000-0000-4000-8000-000000000001";
const roomTypeId = "53000000-0000-4000-8000-000000000001";
const headers = {
  cookie: "__Host-hotel_session=opaque-session-token",
  "content-type": "application/json",
  "idempotency-key": "room-api-test-key",
};
const principal: AuthenticatedPrincipal = {
  companyId: "10000000-0000-4000-8000-000000000001",
  identityId: "30000000-0000-4000-8000-000000000001",
  sessionId: "40000000-0000-4000-8000-000000000001",
  userId: "20000000-0000-4000-8000-000000000001",
  userType: "INTERNAL_STAFF",
  displayName: "객실 관리자",
};
const roomType: HotelRoomType = {
  id: roomTypeId,
  hotelId: null,
  name: "스탠다드 더블",
  scope: "COMPANY",
  displayOrder: 10,
  isActive: true,
  version: 1,
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
};
const internalRoom: HotelRoomInternal = {
  id: roomId,
  hotelId,
  roomNumber: "101",
  floorLabel: "1층",
  floorSortKey: 1,
  roomType: { id: roomTypeId, name: roomType.name, scope: roomType.scope },
  status: "ACTIVE",
  internalNote: "내부 메모",
  ownerVisibleNote: "공개 메모",
  plannedResumeDate: null,
  version: 1,
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
};
const ownerRoom: HotelRoomOwner = {
  ...internalRoom,
  internalNote: undefined,
} as HotelRoomOwner;
delete (ownerRoom as Record<string, unknown>).internalNote;

function authService(active = true): AuthService {
  return {
    beginCustomLogin: vi.fn(),
    beginLogin: vi.fn(),
    completeLogin: vi.fn(),
    finalizeCustomLogin: vi.fn(),
    logout: vi.fn(),
    prepareCustomLogin: vi.fn(),
    resolvePrincipal: vi.fn(async () => (active ? principal : null)),
  } as AuthService;
}

function roomService(overrides: Partial<RoomService> = {}): RoomService {
  return {
    listRoomTypes: vi.fn(async () => ({ status: "OK", roomTypes: [roomType] })),
    createRoomType: vi.fn(async () => ({
      status: "CREATED",
      roomType,
    })),
    updateRoomType: vi.fn(async () => ({
      status: "UPDATED",
      roomType: { ...roomType, version: 2 },
    })),
    listRooms: vi.fn(async () => ({
      status: "OK",
      audience: "INTERNAL",
      capabilities: { canManage: true, canManageTypes: true },
      rooms: [internalRoom],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    })),
    getRoom: vi.fn(async () => ({
      status: "OK",
      audience: "INTERNAL",
      room: internalRoom,
    })),
    createRoom: vi.fn(async () => ({ status: "CREATED", room: internalRoom })),
    updateRoom: vi.fn(async () => ({
      status: "UPDATED",
      room: { ...internalRoom, version: 2 },
    })),
    changeRoomStatus: vi.fn(async () => ({
      status: "STATUS_CHANGED",
      room: { ...internalRoom, status: "OUT_OF_SERVICE", version: 2 },
    })),
    ...overrides,
  } as RoomService;
}

function app(service = roomService(), active = true) {
  return createApp({ authService: authService(active), roomService: service });
}

const createRoomBody = {
  roomNumber: "101",
  floorLabel: "1층",
  floorSortKey: 1,
  roomTypeId,
  internalNote: "내부 메모",
  ownerVisibleNote: "공개 메모",
};

describe("HOTEL-MVP-020 room API", () => {
  it("binds mutation identity to the canonical route and HTTP method", async () => {
    const createRoom = vi.fn(async () => ({
      status: "CREATED" as const,
      room: internalRoom,
    }));
    const service = createRoomService({
      close: vi.fn(),
      createRoom,
    } as unknown as RoomRepository);
    await service.createRoom(
      principal,
      hotelId,
      createRoomBody,
      "service-idempotency-key",
    );
    expect(createRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({
          companyId: principal.companyId,
          sessionId: principal.sessionId,
          userId: principal.userId,
        }),
        hotelId,
        httpMethod: "POST",
        idempotencyKey: "service-idempotency-key",
        operationPath: `/api/hotels/${hotelId}/rooms`,
        requestHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
      }),
    );
  });

  it("requires authentication for room routes", async () => {
    const response = await app(roomService(), false).request(
      `/api/hotels/${hotelId}/rooms`,
    );
    expect(response.status).toBe(401);
  });

  it("parses list filters and returns the internal projection", async () => {
    const listRooms = vi.fn(async () => ({
      status: "OK" as const,
      audience: "INTERNAL" as const,
      capabilities: { canManage: true, canManageTypes: true },
      rooms: [internalRoom],
      pagination: { page: 2, pageSize: 10, total: 11, totalPages: 2 },
    }));
    const response = await app(roomService({ listRooms })).request(
      `/api/hotels/${hotelId}/rooms?q=101&status=ACTIVE&page=2&pageSize=10`,
      { headers },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("vary")).toContain("Cookie");
    expect(listRooms).toHaveBeenCalledWith(
      principal,
      hotelId,
      expect.objectContaining({
        q: "101",
        status: "ACTIVE",
        page: 2,
        pageSize: 10,
      }),
    );
    expect(await response.json()).toMatchObject({
      data: { rooms: [{ internalNote: "내부 메모" }] },
    });
  });

  it("rejects a blank room search before the service", async () => {
    const listRooms = vi.fn();
    const response = await app(roomService({ listRooms })).request(
      `/api/hotels/${hotelId}/rooms?q=%20%20%20&page=1&pageSize=20`,
      { headers },
    );
    expect(response.status).toBe(400);
    expect(listRooms).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        fieldErrors: [{ field: "q" }],
      },
    });
  });

  it("never emits internalNote in an external detail projection", async () => {
    const response = await app(
      roomService({
        getRoom: vi.fn(async () => ({
          status: "OK" as const,
          audience: "EXTERNAL" as const,
          room: ownerRoom,
        })),
      }),
    ).request(`/api/hotels/${hotelId}/rooms/${roomId}`, { headers });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { room: object } };
    expect(body.data.room).not.toHaveProperty("internalNote");
    expect(body.data.room).toHaveProperty("ownerVisibleNote", "공개 메모");
  });

  it("blocks mutation before service when Idempotency-Key is absent", async () => {
    const createRoom = vi.fn();
    const response = await app(roomService({ createRoom })).request(
      `/api/hotels/${hotelId}/rooms`,
      {
        method: "POST",
        headers: {
          cookie: headers.cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify(createRoomBody),
      },
    );
    expect(response.status).toBe(400);
    expect(createRoom).not.toHaveBeenCalled();
  });

  it("strict-validates and forwards room creation", async () => {
    const createRoom = vi.fn(async () => ({
      status: "CREATED" as const,
      room: internalRoom,
    }));
    const response = await app(roomService({ createRoom })).request(
      `/api/hotels/${hotelId}/rooms`,
      { method: "POST", headers, body: JSON.stringify(createRoomBody) },
    );
    expect(response.status).toBe(201);
    expect(createRoom).toHaveBeenCalledWith(
      principal,
      hotelId,
      createRoomBody,
      headers["idempotency-key"],
    );

    const invalid = await app(roomService({ createRoom })).request(
      `/api/hotels/${hotelId}/rooms`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ ...createRoomBody, unexpected: true }),
      },
    );
    expect(invalid.status).toBe(400);
    expect(createRoom).toHaveBeenCalledTimes(1);
  });

  it("rejects an ACTIVE status with planned resume date before service", async () => {
    const changeRoomStatus = vi.fn();
    const response = await app(roomService({ changeRoomStatus })).request(
      `/api/hotels/${hotelId}/rooms/${roomId}/status`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          status: "ACTIVE",
          reason: "운영 재개",
          plannedResumeDate: "2026-08-01",
          version: 1,
        }),
      },
    );
    expect(response.status).toBe(400);
    expect(changeRoomStatus).not.toHaveBeenCalled();
  });

  it.each([
    ["DUPLICATE", 409, "VALIDATION_ERROR"],
    ["VERSION_CONFLICT", 409, "VERSION_CONFLICT"],
    ["ROOM_TYPE_UNAVAILABLE", 409, "VALIDATION_ERROR"],
    ["FORBIDDEN", 403, "FORBIDDEN"],
  ] as const)("maps %s to a stable error", async (status, httpStatus, code) => {
    const response = await app(
      roomService({ createRoom: vi.fn(async () => ({ status })) }),
    ).request(`/api/hotels/${hotelId}/rooms`, {
      method: "POST",
      headers,
      body: JSON.stringify(createRoomBody),
    });
    expect(response.status).toBe(httpStatus);
    expect(await response.json()).toMatchObject({ error: { code } });
  });
});
