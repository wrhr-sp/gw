import type { HotelBasicInformation, HotelErrorCode, HotelListQuery } from "@werehere/contracts";
import { Button, DataTable, EmptyState, FilterBar, PageHeader, Pagination, StatusBadge } from "@werehere/ui";
import { Plus } from "lucide-react";
import { hotelStatusPresentation } from "./hotel-status";

type HotelListViewResult =
  | {
      ok: true;
      capabilities: { canCreate: boolean };
      hotels: HotelBasicInformation[];
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    }
  | { ok: false; error: { code: HotelErrorCode; message: string } };

export function HotelListView({ query, result }: { query: HotelListQuery; result: HotelListViewResult }) {
  const hasFilters = Boolean(query.q || query.status);
  const pageHref = (page: number) => {
    const search = new URLSearchParams({ page: String(page) });
    if (query.q) search.set("q", query.q);
    if (query.status) search.set("status", query.status);
    return `/hotels?${search.toString()}`;
  };

  return (
    <div className="mx-auto flex w-full max-w-hotel-list flex-col gap-6">
      <PageHeader
        actions={result.ok && result.capabilities.canCreate ? (
          <Button asChild>
            <a href="/hotels/new"><Plus aria-hidden="true" className="size-4" />호텔 등록</a>
          </Button>
        ) : undefined}
        description="권한 범위에서 관리 중인 호텔과 계약 기본정보를 조회합니다."
        eyebrow="지점관리"
        title="호텔 관리"
      />

      {result.ok ? (
        <FilterBar>
          <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]" method="get">
          <label className="text-sm font-semibold text-text">
            호텔 검색
            <input className="mt-1 h-11 w-full rounded-control border border-border bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" defaultValue={query.q} name="q" placeholder="호텔명 또는 호텔코드" />
          </label>
          <label className="text-sm font-semibold text-text">
            상태
            <select className="mt-1 h-11 w-full rounded-control border border-border bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" defaultValue={query.status ?? ""} name="status">
              <option value="">전체</option>
              <option value="PREPARING">준비중</option>
              <option value="ACTIVE">운영중</option>
              <option value="SUSPENDED">운영중지</option>
            </select>
          </label>
          <Button className="min-h-11 self-end" type="submit">조회</Button>
          </form>
        </FilterBar>
      ) : null}

      {!result.ok ? (
        <section className="rounded-panel border border-border bg-surface p-6" role="alert">
          <h2 className="text-base font-semibold text-text">
            {result.error.code === "FORBIDDEN" ? "호텔 관리 권한이 없습니다" : "호텔 목록을 불러오지 못했습니다"}
          </h2>
          <p className="mt-2 text-sm text-muted">{result.error.message}</p>
          {result.error.code !== "FORBIDDEN" ? (
            <Button asChild className="mt-4" variant="secondary">
              <a href={pageHref(query.page)}>다시 시도</a>
            </Button>
          ) : null}
        </section>
      ) : result.hotels.length === 0 ? (
        <EmptyState
          action={hasFilters ? <Button asChild variant="secondary"><a href="/hotels">필터 초기화</a></Button> : undefined}
          description={hasFilters
            ? "검색어 또는 상태 조건을 바꿔 주세요."
            : result.capabilities.canCreate
              ? "첫 호텔을 등록하면 목록에서 바로 확인할 수 있습니다."
              : "현재 권한범위에서 조회할 수 있는 호텔이 없습니다."}
          title={hasFilters
            ? "검색 조건에 맞는 호텔이 없습니다"
            : result.capabilities.canCreate ? "등록된 호텔이 없습니다" : "조회 가능한 호텔이 없습니다"}
        />
      ) : (
        <DataTable label="호텔 목록">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-background text-xs font-semibold text-muted">
                <tr>
                  <th className="px-4 py-3" scope="col">호텔코드</th>
                  <th className="px-4 py-3" scope="col">호텔명</th>
                  <th className="px-4 py-3" scope="col">상태</th>
                  <th className="px-4 py-3" scope="col">도로명주소</th>
                  <th className="px-4 py-3" scope="col">대표연락처</th>
                  <th className="px-4 py-3" scope="col">위탁계약기간</th>
                </tr>
              </thead>
              <tbody>
                {result.hotels.map((hotel) => (
                  <tr className="border-t border-border hover:bg-background/70" key={hotel.id}>
                    <td className="px-4 py-4 font-mono text-xs text-muted">{hotel.branchCode}</td>
                    <td className="px-4 py-4 font-semibold text-text">
                      <a className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href={`/hotels/${hotel.id}`}>{hotel.name}</a>
                    </td>
                    <td className="px-4 py-4"><StatusBadge tone={hotelStatusPresentation[hotel.status].tone}>{hotelStatusPresentation[hotel.status].label}</StatusBadge></td>
                    <td className="max-w-sm px-4 py-4 text-muted">{hotel.roadAddress}</td>
                    <td className="px-4 py-4 text-muted">{hotel.representativePhone}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-muted">{hotel.contractStartDate} ~ {hotel.contractEndDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-border md:hidden">
            {result.hotels.map((hotel) => (
              <li key={hotel.id}>
                <a className="block min-h-11 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" href={`/hotels/${hotel.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-text">{hotel.name}</p>
                      <p className="mt-1 font-mono text-xs text-muted">{hotel.branchCode}</p>
                    </div>
                    <StatusBadge tone={hotelStatusPresentation[hotel.status].tone}>{hotelStatusPresentation[hotel.status].label}</StatusBadge>
                  </div>
                  <p className="mt-3 text-sm text-muted">{hotel.roadAddress}</p>
                  <p className="mt-1 text-sm text-muted">{hotel.representativePhone}</p>
                  <p className="mt-1 text-xs text-muted">계약 {hotel.contractStartDate} ~ {hotel.contractEndDate}</p>
                </a>
              </li>
            ))}
          </ul>
        </DataTable>
      )}

      {result.ok && result.pagination.total > 0 ? (
        <div className="rounded-panel border border-border bg-surface">
          <p className="px-4 pt-3 text-sm text-muted">총 {result.pagination.total}개</p>
          <Pagination
            currentPage={result.pagination.page}
            nextHref={result.pagination.page < result.pagination.totalPages ? pageHref(result.pagination.page + 1) : undefined}
            previousHref={result.pagination.page > 1 ? pageHref(result.pagination.page - 1) : undefined}
            totalPages={result.pagination.totalPages}
          />
        </div>
      ) : null}
    </div>
  );
}
