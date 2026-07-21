import { PageHeader } from "@werehere/ui";
import { notFound } from "next/navigation";
import { AccountCreateForm } from "../../../../components/accounts/account-create-form";
import { HotelShell } from "../../../../components/hotels/hotel-shell";
import { requireAuthenticatedPrincipal } from "../../../../lib/server-auth";
import { fetchAccountCapabilitiesResult } from "../../../../lib/server-accounts";
import { fetchHotelList } from "../../../../lib/server-hotels";

export const dynamic = "force-dynamic";

export default async function NewAdminUserPage() {
  const [principal, capabilities] = await Promise.all([
    requireAuthenticatedPrincipal(),
    fetchAccountCapabilitiesResult(),
  ]);
  if (!capabilities.ok) {
    return <HotelShell accountPermissions={[]} currentPath="/admin/users" principal={principal}>
      <section className="rounded-panel border border-border bg-surface p-6" role="alert">
        <h1 className="font-semibold">사용자 계정 권한 정보를 확인하지 못했습니다</h1>
        <p className="mt-2 text-sm text-muted">{capabilities.error.message}</p>
        <a className="mt-4 inline-flex min-h-11 items-center rounded-control border border-border px-4 text-sm font-semibold" href="/admin/users/new">다시 시도</a>
      </section>
    </HotelShell>;
  }
  const permissions = capabilities.permissions;
  if (!permissions.includes("USER_CREATE")) notFound();
  const hotels = await fetchHotelList({ page: 1, pageSize: 100 });
  const content = !hotels.ok ? (
    <section className="rounded-panel border border-border bg-surface p-6" role="alert">
      <h2 className="font-semibold">호텔 목록을 불러오지 못했습니다</h2>
      <p className="mt-2 text-sm text-muted">{hotels.error.message}</p>
    </section>
  ) : hotels.hotels.length === 0 ? (
    <section className="rounded-panel border border-border bg-surface p-6">
      <h2 className="font-semibold">배정 가능한 호텔이 없습니다</h2>
      <p className="mt-2 text-sm text-muted">활성 호텔을 먼저 등록한 뒤 사용자 계정을 생성해 주세요.</p>
    </section>
  ) : <AccountCreateForm hotels={hotels.hotels.map(({ id, name }) => ({ id, name }))} />;
  return <HotelShell accountPermissions={permissions} currentPath="/admin/users" principal={principal}>
    <div className="mx-auto flex w-full max-w-hotel-detail flex-col gap-6">
      <PageHeader eyebrow="사용자 계정" title="사용자 생성" description="사람 계정과 호텔관리 업무범위를 한 번에 생성합니다." />
      {content}
    </div>
  </HotelShell>;
}
