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
): Promise<
  | { ok: true; data: FacilityInitialData }
  | { ok: false; error: FacilityInitialFailure }
> {
  const headers = new Headers();
  const cookieHeader = (await cookies()).toString();
  if (cookieHeader) headers.set("cookie", cookieHeader);
  let response: Response;
  try {
    response = await fetchApi(
      `${hotelRoutes.facilityWorkspace(hotelId)}?page=1&pageSize=20`,
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
