import {
  hotelErrorResponseSchema,
  hotelRoomInternalListResponseSchema,
  hotelRoomOwnerListResponseSchema,
  hotelRoomTypeListResponseSchema,
  hotelRoutes,
  type HotelErrorCode,
  type HotelRoomInternal,
  type HotelRoomOwner,
  type HotelRoomType,
} from "@werehere/contracts";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchApi } from "./api-transport";

export type RoomInitialData = {
  capabilities: { canManage: boolean; canManageTypes: boolean };
  roomTypes: HotelRoomType[];
  rooms: Array<HotelRoomInternal | HotelRoomOwner>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
export type RoomInitialFailure = {
  code: HotelErrorCode;
  message: string;
  status: number;
};

async function request(path: string): Promise<Response> {
  const cookieHeader = (await cookies()).toString();
  const headers = new Headers();
  if (cookieHeader) headers.set("cookie", cookieHeader);
  try {
    return await fetchApi(path, { cache: "no-store", headers });
  } catch {
    return new Response(null, { status: 503 });
  }
}

async function failure(response: Response): Promise<RoomInitialFailure> {
  try {
    const parsed = hotelErrorResponseSchema.safeParse(await response.json());
    if (parsed.success)
      return {
        code: parsed.data.error.code,
        message: parsed.data.error.message,
        status: response.status,
      };
  } catch {
    // Stable user-facing failure below.
  }
  return {
    code: "INTERNAL_ERROR",
    message: "객실 정보를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
    status: response.status,
  };
}

export async function fetchRoomInitialData(
  hotelId: string,
): Promise<
  { ok: true; data: RoomInitialData } | { ok: false; error: RoomInitialFailure }
> {
  const [roomsResponse, roomTypesResponse] = await Promise.all([
    request(`${hotelRoutes.rooms(hotelId)}?page=1&pageSize=20`),
    request(hotelRoutes.roomTypes(hotelId)),
  ]);
  if (roomsResponse.status === 401 || roomTypesResponse.status === 401)
    redirect("/login");
  if (!roomsResponse.ok)
    return { ok: false, error: await failure(roomsResponse) };
  if (!roomTypesResponse.ok)
    return { ok: false, error: await failure(roomTypesResponse) };
  try {
    const roomValue: unknown = await roomsResponse.json();
    const internal = hotelRoomInternalListResponseSchema.safeParse(roomValue);
    const external = hotelRoomOwnerListResponseSchema.safeParse(roomValue);
    const types = hotelRoomTypeListResponseSchema.safeParse(
      await roomTypesResponse.json(),
    );
    const roomData = internal.success
      ? internal.data.data
      : external.success
        ? external.data.data
        : null;
    if (roomData && types.success)
      return {
        ok: true,
        data: {
          capabilities: roomData.capabilities,
          pagination: roomData.pagination,
          rooms: roomData.rooms,
          roomTypes: types.data.data.roomTypes,
        },
      };
  } catch {
    // Stable user-facing failure below.
  }
  return {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "객실 목록 응답이 올바르지 않습니다.",
      status: 502,
    },
  };
}
