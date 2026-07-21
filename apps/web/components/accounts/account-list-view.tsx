import type { Account, HotelErrorCode } from "@werehere/contracts";
import { Button, DataTable, EmptyState, PageHeader, StatusBadge } from "@werehere/ui";
import { Plus } from "lucide-react";

const typeLabel = { INTERNAL_STAFF: "사내 임직원", HOUSEKEEPING: "하우스키핑", HOTEL_OWNER: "호텔 소유주" } as const;
const statusLabel = { PENDING_SETUP: "최초 설정 대기", ACTIVE: "활성", INACTIVE: "중지", LOCKED: "잠김" } as const;
const statusTone = { PENDING_SETUP: "warning", ACTIVE: "success", INACTIVE: "neutral", LOCKED: "danger" } as const;

type Result =
  | { ok: true; accounts: Account[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }
  | { ok: false; error: { code: HotelErrorCode; message: string } };

type AccountListFilters = {
  q?: string | undefined;
  status?: string | undefined;
  userType?: string | undefined;
};

function pageHref(page: number, query: AccountListFilters) {
  const search = new URLSearchParams({ page: String(page) });
  if (query.q) search.set("q", query.q);
  if (query.status) search.set("status", query.status);
  if (query.userType) search.set("userType", query.userType);
  return `/admin/users?${search.toString()}`;
}

export function AccountListView({ canCreate, query = {}, result }: {
  canCreate: boolean;
  query?: AccountListFilters;
  result: Result;
}) {
  const hasFilters = Boolean(query.q || query.status || query.userType);
  return (
    <div className="mx-auto flex w-full max-w-hotel-list flex-col gap-6">
      <PageHeader
        actions={result.ok && canCreate ? <Button asChild className="min-h-11"><a href="/admin/users/new"><Plus aria-hidden="true" className="size-4" />사용자 생성</a></Button> : undefined}
        description="회사 사용자와 로그인 상태, 사용자유형, 호텔 연결을 관리합니다."
        eyebrow="관리자"
        title="사용자 계정"
      />
      <form action="/admin/users" className="grid gap-3 rounded-panel border border-border bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]" method="get">
        <label className="text-sm font-semibold" htmlFor="account-search">사용자 검색
          <input className="mt-1 h-11 w-full rounded-control border border-border px-3 font-normal" defaultValue={query.q} id="account-search" name="q" />
        </label>
        <label className="text-sm font-semibold" htmlFor="account-status-filter">상태 필터
          <select className="mt-1 h-11 w-full rounded-control border border-border px-3 font-normal" defaultValue={query.status ?? ""} id="account-status-filter" name="status">
            <option value="">전체 상태</option><option value="PENDING_SETUP">최초 설정 대기</option><option value="ACTIVE">활성</option><option value="INACTIVE">중지</option><option value="LOCKED">잠김</option>
          </select>
        </label>
        <label className="text-sm font-semibold" htmlFor="account-type-filter">사용자유형 필터
          <select className="mt-1 h-11 w-full rounded-control border border-border px-3 font-normal" defaultValue={query.userType ?? ""} id="account-type-filter" name="userType">
            <option value="">전체 유형</option><option value="INTERNAL_STAFF">사내 임직원</option><option value="HOUSEKEEPING">하우스키핑</option><option value="HOTEL_OWNER">호텔 소유주</option>
          </select>
        </label>
        <div className="flex items-end gap-2"><Button className="min-h-11" type="submit">조회</Button><Button asChild className="min-h-11" variant="secondary"><a href="/admin/users">초기화</a></Button></div>
      </form>
      {!result.ok ? (
        <section className="rounded-panel border border-border bg-surface p-6" role="alert">
          <h2 className="font-semibold text-text">{result.error.code === "FORBIDDEN" ? "사용자 계정 관리 권한이 없습니다" : "사용자 계정을 불러오지 못했습니다"}</h2>
          <p className="mt-2 text-sm text-muted">{result.error.message}</p>
          {result.error.code !== "FORBIDDEN" ? <Button asChild className="mt-4 min-h-11" variant="secondary"><a href={pageHref(1, query)}>다시 시도</a></Button> : null}
        </section>
      ) : result.accounts.length === 0 ? (
        <EmptyState
          action={hasFilters ? <Button asChild variant="secondary"><a href="/admin/users">필터 초기화</a></Button> : undefined}
          title={hasFilters
            ? "검색 조건에 맞는 사용자가 없습니다"
            : canCreate ? "생성된 사용자 계정이 없습니다" : "조회 가능한 사용자 계정이 없습니다"}
          description={hasFilters
            ? "검색어 또는 상태·사용자유형 조건을 바꿔 주세요."
            : canCreate
              ? "첫 사용자를 생성하면 이 목록에서 확인할 수 있습니다."
              : "현재 권한범위에서 조회할 수 있는 사용자 계정이 없습니다."}
        />
      ) : (
        <DataTable label="사용자 계정 목록">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-background text-xs font-semibold text-muted"><tr>
                <th className="px-4 py-3">이름</th><th className="px-4 py-3">로그인 아이디</th><th className="px-4 py-3">사용자유형</th><th className="px-4 py-3">대표 호텔</th><th className="px-4 py-3">상태</th><th className="px-4 py-3">이메일</th>
              </tr></thead>
              <tbody>{result.accounts.map((account) => <tr className="border-t border-border" key={account.id}>
                <td className="px-4 py-4 font-semibold"><a className="hover:text-primary" href={`/admin/users/${account.id}`}>{account.displayName}</a></td>
                <td className="px-4 py-4 text-muted">{account.loginName}</td>
                <td className="px-4 py-4">{typeLabel[account.userType]}</td>
                <td className="px-4 py-4 text-muted">{account.hotelName ? `${account.hotelName}${account.hotelCode ? ` (${account.hotelCode})` : ""}` : "없음"}</td>
                <td className="px-4 py-4"><StatusBadge tone={statusTone[account.status]}>{statusLabel[account.status]}</StatusBadge></td>
                <td className="px-4 py-4 text-muted">{account.email}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <ul className="divide-y divide-border md:hidden">{result.accounts.map((account) => <li key={account.id}>
            <a className="block min-h-11 p-4" href={`/admin/users/${account.id}`}>
              <div className="flex justify-between gap-3"><div><p className="font-semibold">{account.displayName}</p><p className="mt-1 text-xs text-muted">{account.loginName} · {typeLabel[account.userType]}</p></div><StatusBadge tone={statusTone[account.status]}>{statusLabel[account.status]}</StatusBadge></div>
              <p className="mt-2 text-sm text-muted">{account.hotelName ? `${account.hotelName}${account.hotelCode ? ` (${account.hotelCode})` : ""}` : "연결 호텔 없음"}</p>
              <p className="mt-3 text-sm text-muted">{account.email}</p>
            </a>
          </li>)}</ul>
        </DataTable>
      )}
      {result.ok && result.pagination.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <p>총 {result.pagination.total}개 · {result.pagination.page}/{result.pagination.totalPages} 페이지</p>
          <nav aria-label="사용자 목록 페이지" className="flex gap-2">
            {result.pagination.page > 1 ? <Button asChild className="min-h-11" variant="secondary"><a href={pageHref(result.pagination.page - 1, query)}>이전</a></Button> : null}
            {result.pagination.page < result.pagination.totalPages ? <Button asChild className="min-h-11" variant="secondary"><a href={pageHref(result.pagination.page + 1, query)}>다음</a></Button> : null}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
