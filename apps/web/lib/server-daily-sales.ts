import {
  dailySalesCapabilitiesResponseSchema,
  dailySalesInternalResponseSchema,
  dailySalesListResponseSchema,
  dailySalesOwnerResponseSchema,
  dailySalesReferenceResponseSchema,
  dailySalesRoutes,
  hotelErrorResponseSchema,
} from "@werehere/contracts";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchApi } from "./api-transport";
async function request(path: string) {
  const headers = new Headers();
  const cookie = (await cookies()).toString();
  if (cookie) headers.set("cookie", cookie);
  try {
    return await fetchApi(path, { cache: "no-store", headers });
  } catch {
    return new Response(null, { status: 503 });
  }
}
function detail(value: unknown) {
  const internal = dailySalesInternalResponseSchema.safeParse(value);
  if (internal.success) return internal.data.data.sales;
  const owner = dailySalesOwnerResponseSchema.safeParse(value);
  return owner.success ? owner.data.data.sales : null;
}
export async function fetchDailySalesCapabilities() {
  const response = await request(dailySalesRoutes.capabilities);
  if (response.status === 401) redirect("/login");
  if (!response.ok) return [];
  const parsed = dailySalesCapabilitiesResponseSchema.safeParse(
    await response.json().catch(() => undefined),
  );
  return parsed.success ? parsed.data.data.hotels : [];
}
export async function fetchDailySales(hotelId: string) {
  const [listResponse, referenceResponse, capabilityResponse] =
    await Promise.all([
      request(`${dailySalesRoutes.list(hotelId)}?page=1&pageSize=100`),
      request(dailySalesRoutes.references(hotelId)),
      request(dailySalesRoutes.capabilities),
    ]);
  if (
    [listResponse, referenceResponse, capabilityResponse].some(
      (r) => r.status === 401,
    )
  )
    redirect("/login");
  if (!listResponse.ok) {
    const error = hotelErrorResponseSchema.safeParse(
      await listResponse.json().catch(() => undefined),
    );
    return {
      ok: false as const,
      code: error.success ? error.data.error.code : ("INTERNAL_ERROR" as const),
      error: error.success
        ? error.data.error.message
        : "일매출 장부를 불러오지 못했습니다.",
    };
  }
  const list = dailySalesListResponseSchema.safeParse(
    await listResponse.json().catch(() => undefined),
  );
  const references = dailySalesReferenceResponseSchema.safeParse(
    await referenceResponse.json().catch(() => undefined),
  );
  const capabilities = dailySalesCapabilitiesResponseSchema.safeParse(
    await capabilityResponse.json().catch(() => undefined),
  );
  if (!list.success || !references.success || !capabilities.success)
    return {
      ok: false as const,
      code: "INTERNAL_ERROR" as const,
      error: "일매출 응답을 안전하게 확인하지 못했습니다.",
    };
  let selected = null;
  if (list.data.data.sales[0]) {
    const response = await request(
      dailySalesRoutes.detail(hotelId, list.data.data.sales[0].id),
    );
    if (
      !response.ok ||
      (selected = detail(await response.json().catch(() => undefined))) === null
    )
      return {
        ok: false as const,
        code: "INTERNAL_ERROR" as const,
        error: "일매출 상세를 불러오지 못했습니다.",
      };
  }
  return {
    ok: true as const,
    sales: list.data.data.sales,
    references: references.data.data,
    capability:
      capabilities.data.data.hotels.find((c) => c.hotelId === hotelId) ?? null,
    selected,
  };
}
