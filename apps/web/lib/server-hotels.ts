import {
  hotelDetailResponseSchema,
  hotelErrorResponseSchema,
  hotelListQuerySchema,
  hotelListResponseSchema,
  type HotelBasicInformation,
  type HotelErrorCode,
  type HotelListQuery,
} from "@werehere/contracts";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchApi } from "./api-transport";

export type HotelApiFailure = {
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

async function failure(response: Response): Promise<HotelApiFailure> {
  try {
    const parsed = hotelErrorResponseSchema.safeParse(await response.json());
    if (parsed.success) {
      return {
        code: parsed.data.error.code,
        message: parsed.data.error.message,
        status: response.status,
      };
    }
  } catch {
    // A stable local fallback is returned below.
  }
  return {
    code: "INTERNAL_ERROR",
    message: "호텔 정보를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
    status: response.status,
  };
}

export async function fetchHotelList(queryInput: Partial<HotelListQuery> = {}): Promise<
  | {
      ok: true;
      capabilities: { canCreate: boolean };
      hotels: HotelBasicInformation[];
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    }
  | { ok: false; error: HotelApiFailure }
> {
  const query = hotelListQuerySchema.parse(queryInput);
  const search = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.q) search.set("q", query.q);
  if (query.status) search.set("status", query.status);
  const response = await request(`/api/hotels?${search.toString()}`);
  if (response.status === 401) redirect("/login");
  if (!response.ok) return { ok: false, error: await failure(response) };
  try {
    const parsed = hotelListResponseSchema.safeParse(await response.json());
    if (parsed.success) return {
      ok: true,
      capabilities: parsed.data.data.capabilities,
      hotels: parsed.data.data.hotels,
      pagination: parsed.data.data.pagination,
    };
  } catch {
    // Invalid upstream JSON is handled as a stable failure below.
  }
  return {
    ok: false,
    error: { code: "INTERNAL_ERROR", message: "호텔 목록 응답이 올바르지 않습니다.", status: 502 },
  };
}

export async function fetchHotelDetail(hotelId: string): Promise<
  | { ok: true; hotel: HotelBasicInformation }
  | { ok: false; error: HotelApiFailure }
> {
  const response = await request(`/api/hotels/${encodeURIComponent(hotelId)}`);
  if (response.status === 401) redirect("/login");
  if (!response.ok) return { ok: false, error: await failure(response) };
  try {
    const parsed = hotelDetailResponseSchema.safeParse(await response.json());
    if (parsed.success) return { ok: true, hotel: parsed.data.data.hotel };
  } catch {
    // Invalid upstream JSON is handled as a stable failure below.
  }
  return {
    ok: false,
    error: { code: "INTERNAL_ERROR", message: "호텔 상세 응답이 올바르지 않습니다.", status: 502 },
  };
}
