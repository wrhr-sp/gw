import { notFound } from "next/navigation";
import { AccountDetailView } from "../../../../components/accounts/account-detail-view";
import { HotelShell } from "../../../../components/hotels/hotel-shell";
import { requireAuthenticatedPrincipal } from "../../../../lib/server-auth";
import { fetchAccountCapabilitiesResult, fetchAccountDetail } from "../../../../lib/server-accounts";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const [principal, capabilities] = await Promise.all([
    requireAuthenticatedPrincipal(),
    fetchAccountCapabilitiesResult(),
  ]);
  const { userId } = await params;
  if (!capabilities.ok) {
    return <HotelShell accountPermissions={[]} currentPath="/admin/users" principal={principal}>
      <section className="rounded-panel border border-border bg-surface p-6" role="alert">
        <h1 className="font-semibold">사용자 계정 권한 정보를 확인하지 못했습니다</h1>
        <p className="mt-2 text-sm text-muted">{capabilities.error.message}</p>
        <a className="mt-4 inline-flex min-h-11 items-center rounded-control border border-border px-4 text-sm font-semibold" href={`/admin/users/${encodeURIComponent(userId)}`}>다시 시도</a>
      </section>
    </HotelShell>;
  }
  const permissions = capabilities.permissions;
  if (!permissions.includes("USER_READ")) notFound();
  const result = await fetchAccountDetail(userId);
  if (!result.ok && result.error.code === "ACCOUNT_NOT_FOUND") notFound();
  return <HotelShell accountPermissions={permissions} currentPath="/admin/users" principal={principal}>
    {result.ok ? <AccountDetailView account={result.account} canSuspend={permissions.includes("USER_SUSPEND")} /> : <section className="rounded-panel border border-border bg-surface p-6" role="alert"><h1 className="font-semibold">사용자 상세를 불러오지 못했습니다</h1><p className="mt-2 text-sm text-muted">{result.error.message}</p></section>}
  </HotelShell>;
}
