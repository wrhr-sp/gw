import type { HotelBasicInformation } from "@werehere/contracts";
import { Button, PageHeader, StatusBadge } from "@werehere/ui";
import type { HotelApiFailure } from "../../lib/server-hotels";
import { hotelStatusPresentation } from "./hotel-status";

type HotelDetailViewResult =
  | { ok: true; hotel: HotelBasicInformation }
  | { ok: false; error: HotelApiFailure };

export function HotelDetailView({ result, retryHref = "" }: { result: HotelDetailViewResult; retryHref?: string }) {
  return (
    <div className="mx-auto flex w-full max-w-hotel-detail flex-col gap-6">
      <div><a className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline" href="/hotels">← 호텔 목록</a></div>
      {!result.ok ? (
        <section className="rounded-panel border border-border bg-surface p-6" role="alert">
          <h1 className="text-lg font-semibold text-text">호텔 정보를 불러오지 못했습니다</h1>
          <p className="mt-2 text-sm text-muted">{result.error.message}</p>
          <Button asChild className="mt-4" variant="secondary">
            <a href={retryHref}>다시 시도</a>
          </Button>
        </section>
      ) : (
        <>
          <PageHeader
            actions={<StatusBadge tone={hotelStatusPresentation[result.hotel.status].tone}>{hotelStatusPresentation[result.hotel.status].label}</StatusBadge>}
            description={`호텔코드 ${result.hotel.branchCode}`}
            eyebrow="호텔 상세"
            title={result.hotel.name}
          />
          <div aria-label="호텔 상세 탭" className="border-b border-border">
            <span aria-current="page" className="inline-flex min-h-11 items-center border-b-2 border-primary px-1 text-sm font-semibold text-primary">기본정보</span>
          </div>
          <section className="rounded-panel border border-border bg-surface p-5 md:p-6">
            <h2 className="text-base font-semibold text-text">호텔 기본정보</h2>
            <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <div><dt className="text-xs font-semibold text-muted">호텔코드</dt><dd className="mt-1 text-sm text-text">{result.hotel.branchCode}</dd></div>
              <div><dt className="text-xs font-semibold text-muted">호텔명</dt><dd className="mt-1 text-sm text-text">{result.hotel.name}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs font-semibold text-muted">도로명주소</dt><dd className="mt-1 text-sm text-text">{result.hotel.roadAddress}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs font-semibold text-muted">상세주소</dt><dd className="mt-1 text-sm text-text">{result.hotel.detailAddress || "없음"}</dd></div>
              <div><dt className="text-xs font-semibold text-muted">대표연락처</dt><dd className="mt-1 text-sm text-text">{result.hotel.representativePhone}</dd></div>
              <div><dt className="text-xs font-semibold text-muted">위탁계약기간</dt><dd className="mt-1 text-sm text-text">{result.hotel.contractStartDate} ~ {result.hotel.contractEndDate}</dd></div>
              <div><dt className="text-xs font-semibold text-muted">데이터 버전</dt><dd className="mt-1 text-sm text-text">{result.hotel.version}</dd></div>
              <div><dt className="text-xs font-semibold text-muted">최종 반영시각</dt><dd className="mt-1 text-sm text-text">{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(result.hotel.updatedAt))}</dd></div>
            </dl>
          </section>
        </>
      )}
    </div>
  );
}
