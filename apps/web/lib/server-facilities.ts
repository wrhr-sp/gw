import {
  hotelErrorResponseSchema,
  hotelFacilityWorkspaceResponseSchema,
  hotelRoutes,
  type HotelErrorCode,
} from "@werehere/contracts";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchApi } from "./api-transport";
export type FacilityInitialData =
  (typeof hotelFacilityWorkspaceResponseSchema._output)["data"];
export type FacilityInitialFailure = {
  code: HotelErrorCode;
  message: string;
  status: number;
};
export async function fetchFacilityInitialData(
  hotelId: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<
  | { ok: true; data: FacilityInitialData }
  | { ok: false; error: FacilityInitialFailure }
> {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;
  const headers = new Headers();
  const cookieHeader = (await cookies()).toString();
  if (cookieHeader) headers.set("cookie", cookieHeader);
  let response: Response;
  try {
    response = await fetchApi(
      `${hotelRoutes.facilityWorkspace(hotelId)}?page=${page}&pageSize=${pageSize}`,
      { cache: "no-store", headers },
    );
  } catch {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "시설물 기준정보를 불러올 수 없습니다.",
        status: 503,
      },
    };
  }
  if (response.status === 401) redirect("/login");
  if (!response.ok) {
    const parsed = hotelErrorResponseSchema.safeParse(
      await response.json().catch(() => null),
    );
    if (parsed.success)
      return {
        ok: false,
        error: {
          code: parsed.data.error.code,
          message: parsed.data.error.message,
          status: response.status,
        },
      };
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "시설물 기준정보를 불러올 수 없습니다.",
        status: response.status,
      },
    };
  }
  try {
    const parsed = hotelFacilityWorkspaceResponseSchema.parse(
      await response.json(),
    );
    return { ok: true, data: parsed.data };
  } catch {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "시설물 기준정보 응답이 올바르지 않습니다.",
        status: 502,
      },
    };
  }
}

export async function fetchAllFacilityInspectionData(
  hotelId: string,
): Promise<
  | { ok: true; data: FacilityInitialData }
  | { ok: false; error: FacilityInitialFailure }
> {
  const first = await fetchFacilityInitialData(hotelId, { page: 1, pageSize: 100 });
  if (!first.ok) return first;
  const facilities = [...first.data.facilities];
  const seen = new Set(facilities.map((facility) => facility.id));
  for (let page = 2; page <= first.data.pagination.totalPages; page += 1) {
    const next = await fetchFacilityInitialData(hotelId, { page, pageSize: 100 });
    if (!next.ok) return next;
    for (const facility of next.data.facilities) {
      if (seen.has(facility.id))
        return {
          ok: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "시설물 전체 목록이 페이지 사이에서 변경되었습니다.",
            status: 409,
          },
        };
      seen.add(facility.id);
      facilities.push(facility);
    }
  }
  if (facilities.length !== first.data.pagination.total)
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "시설물 전체 목록을 완전하게 불러오지 못했습니다.",
        status: 409,
      },
    };
  return {
    ok: true,
    data: {
      ...first.data,
      facilities,
    },
  };
}
