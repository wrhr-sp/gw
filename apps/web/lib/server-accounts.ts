import {
  accountCapabilitiesResponseSchema,
  accountDetailResponseSchema,
  accountEligibleHotelsResponseSchema,
  accountListQuerySchema,
  accountListResponseSchema,
  hotelErrorResponseSchema,
  type Account,
  type AccountEligibleHotel,
  type AccountPermission,
  type AccountListQuery,
  type HotelErrorCode,
} from "@werehere/contracts";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchApi } from "./api-transport";

export type Failure = { code: HotelErrorCode; message: string; status: number };
export type AccountCapabilitiesResult =
  | { ok: true; permissions: AccountPermission[] }
  | { ok: false; error: Failure };

async function request(path: string) {
  const headers = new Headers();
  const cookieHeader = (await cookies()).toString();
  if (cookieHeader) headers.set("cookie", cookieHeader);
  try { return await fetchApi(path, { cache: "no-store", headers }); }
  catch { return new Response(null, { status: 503 }); }
}

async function failure(response: Response): Promise<Failure> {
  try {
    const parsed = hotelErrorResponseSchema.safeParse(await response.json());
    if (parsed.success) return { ...parsed.data.error, status: response.status };
  } catch { /* stable fallback below */ }
  return { code: "INTERNAL_ERROR", message: "사용자 계정 정보를 불러올 수 없습니다.", status: response.status };
}

export async function fetchAccountCapabilitiesResult(): Promise<AccountCapabilitiesResult> {
  const response = await request("/api/admin/users/capabilities");
  if (response.status === 401) redirect("/login");
  if (!response.ok) return { ok: false, error: await failure(response) };
  try {
    const parsed = accountCapabilitiesResponseSchema.safeParse(await response.json());
    if (parsed.success) return { ok: true, permissions: parsed.data.data.permissions };
  } catch { /* stable fallback below */ }
  return {
    ok: false,
    error: { code: "INTERNAL_ERROR", message: "사용자 계정 권한 응답이 올바르지 않습니다.", status: 502 },
  };
}

export async function fetchAccountCapabilities(): Promise<AccountPermission[]> {
  const result = await fetchAccountCapabilitiesResult();
  return result.ok ? result.permissions : [];
}

export async function fetchEligibleHotels(): Promise<
  | { ok: true; hotels: AccountEligibleHotel[] }
  | { ok: false; error: Failure }
> {
  const response = await request("/api/admin/users/eligible-hotels");
  if (response.status === 401) redirect("/login");
  if (!response.ok) return { ok: false, error: await failure(response) };
  try {
    const parsed = accountEligibleHotelsResponseSchema.safeParse(await response.json());
    if (parsed.success) return { ok: true, hotels: parsed.data.data.hotels };
  } catch { /* stable fallback below */ }
  return {
    ok: false,
    error: { code: "INTERNAL_ERROR", message: "배정 가능한 호텔 응답이 올바르지 않습니다.", status: 502 },
  };
}

export async function fetchAccountList(queryInput: Partial<AccountListQuery> = {}): Promise<
  | { ok: true; accounts: Account[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }
  | { ok: false; error: Failure }
> {
  const query = accountListQuerySchema.parse(queryInput);
  const search = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.q) search.set("q", query.q);
  if (query.status) search.set("status", query.status);
  if (query.userType) search.set("userType", query.userType);
  const response = await request(`/api/admin/users?${search}`);
  if (response.status === 401) redirect("/login");
  if (!response.ok) return { ok: false, error: await failure(response) };
  try {
    const parsed = accountListResponseSchema.safeParse(await response.json());
    if (parsed.success) return { ok: true, accounts: parsed.data.data.accounts, pagination: parsed.data.data.pagination };
  } catch { /* stable fallback below */ }
  return { ok: false, error: { code: "INTERNAL_ERROR", message: "사용자 목록 응답이 올바르지 않습니다.", status: 502 } };
}

export async function fetchAccountDetail(userId: string): Promise<
  | { ok: true; account: Account }
  | { ok: false; error: Failure }
> {
  const response = await request(`/api/admin/users/${encodeURIComponent(userId)}`);
  if (response.status === 401) redirect("/login");
  if (!response.ok) return { ok: false, error: await failure(response) };
  try {
    const parsed = accountDetailResponseSchema.safeParse(await response.json());
    if (parsed.success) return { ok: true, account: parsed.data.data.account };
  } catch { /* stable fallback below */ }
  return { ok: false, error: { code: "INTERNAL_ERROR", message: "사용자 상세 응답이 올바르지 않습니다.", status: 502 } };
}
