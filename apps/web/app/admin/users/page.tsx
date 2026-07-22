import { accountListQuerySchema } from "@werehere/contracts";
import { notFound, redirect } from "next/navigation";
import { AccountListView } from "../../../components/accounts/account-list-view";
import { HotelShell } from "../../../components/hotels/hotel-shell";
import { requireAuthenticatedPrincipal } from "../../../lib/server-auth";
import { fetchAccountCapabilitiesResult, fetchAccountList } from "../../../lib/server-accounts";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; userType?: string }>;
}) {
  const [principal, capabilities] = await Promise.all([
    requireAuthenticatedPrincipal(),
    fetchAccountCapabilitiesResult(),
  ]);
  if (!capabilities.ok) {
    return <HotelShell accountPermissions={[]} currentPath="/admin/users" principal={principal}>
      <section className="rounded-panel border border-border bg-surface p-6" role="alert">
        <h1 className="font-semibold">사용자 계정 권한 정보를 확인하지 못했습니다</h1>
        <p className="mt-2 text-sm text-muted">{capabilities.error.message}</p>
        <a className="mt-4 inline-flex min-h-11 items-center rounded-control border border-border px-4 text-sm font-semibold" href="/admin/users">다시 시도</a>
      </section>
    </HotelShell>;
  }
  const permissions = capabilities.permissions;
  if (!permissions.includes("USER_READ")) notFound();
  const raw = await searchParams;
  const parsed = accountListQuerySchema.safeParse({
    page: raw.page,
    pageSize: 20,
    q: raw.q || undefined,
    status: raw.status || undefined,
    userType: raw.userType || undefined,
  });
  const query = parsed.success ? parsed.data : accountListQuerySchema.parse({});
  const result = await fetchAccountList(query);
  if (result.ok && result.pagination.page !== query.page) {
    const canonical = new URLSearchParams({ page: String(result.pagination.page) });
    if (query.q) canonical.set("q", query.q);
    if (query.status) canonical.set("status", query.status);
    if (query.userType) canonical.set("userType", query.userType);
    redirect(`/admin/users?${canonical.toString()}`);
  }
  return <HotelShell accountPermissions={permissions} currentPath="/admin/users" principal={principal}>
    <AccountListView canCreate={permissions.includes("USER_CREATE")} query={query} result={result} />
  </HotelShell>;
}
