import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HotelDetailView } from "../components/hotels/hotel-detail-view";
import { HotelListView } from "../components/hotels/hotel-list-view";

const hotel = {
  id: "50000000-0000-4000-8000-000000000001",
  branchCode: "HOTEL-GN",
  name: "위아히어 강남호텔",
  roadAddress: "서울특별시 강남구 테헤란로 1",
  detailAddress: "",
  representativePhone: "02-1234-5678",
  contractStartDate: "2026-07-01",
  contractEndDate: "2027-06-30",
  status: "PREPARING" as const,
  version: 1,
  createdAt: "2026-07-16T00:00:00.000Z",
  updatedAt: "2026-07-16T00:00:00.000Z",
};

describe("hotel list and detail views", () => {
  it("renders persisted fields without unapproved placeholder metrics", () => {
    const html = renderToStaticMarkup(
      <HotelListView
        query={{ page: 1, pageSize: 20 }}
        result={{ ok: true, capabilities: { canCreate: true }, hotels: [hotel], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }}
      />,
    );
    expect(html).toContain("호텔코드");
    expect(html).toContain("위아히어 강남호텔");
    expect(html).toContain("md:hidden");
    expect(html).not.toMatch(/점유율|매출|객실 수|담당자/);
  });

  it("keeps forbidden distinct from a successful empty list", () => {
    const forbidden = renderToStaticMarkup(
      <HotelListView
        query={{ page: 1, pageSize: 20 }}
        result={{ ok: false, error: { code: "FORBIDDEN", message: "권한이 없습니다." } }}
      />,
    );
    const empty = renderToStaticMarkup(
      <HotelListView
        query={{ page: 1, pageSize: 20 }}
        result={{ ok: true, capabilities: { canCreate: true }, hotels: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }}
      />,
    );
    const filteredEmpty = renderToStaticMarkup(
      <HotelListView
        query={{ page: 1, pageSize: 20, q: "없는호텔" }}
        result={{ ok: true, capabilities: { canCreate: true }, hotels: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }}
      />,
    );
    const branchScoped = renderToStaticMarkup(
      <HotelListView
        query={{ page: 1, pageSize: 20 }}
        result={{ ok: true, capabilities: { canCreate: false }, hotels: [hotel], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }}
      />,
    );
    expect(forbidden).toContain("호텔 관리 권한이 없습니다");
    expect(forbidden).not.toContain("호텔 등록");
    expect(branchScoped).toContain("위아히어 강남호텔");
    expect(branchScoped).not.toContain("호텔 등록");
    expect(empty).toContain("등록된 호텔이 없습니다");
    expect(filteredEmpty).toContain("검색 조건에 맞는 호텔이 없습니다");
    expect(filteredEmpty).toContain("필터 초기화");
  });

  it("renders the DB read-back detail including empty optional address and version", () => {
    const html = renderToStaticMarkup(<HotelDetailView result={{ ok: true, hotel }} />);
    expect(html).toContain("위아히어 강남호텔");
    expect(html).toContain("상세주소");
    expect(html).toContain("없음");
    expect(html).toContain("데이터 버전");
  });
});
