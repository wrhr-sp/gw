import { HotelDetailView } from "../../components/hotels/hotel-detail-view";
import { HotelShell } from "../../components/hotels/hotel-shell";

const hotel = {
  id: "50000000-0000-4000-8000-000000000001",
  branchCode: "HOTEL-GN",
  name: "위아히어 강남호텔",
  roadAddress: "서울특별시 강남구 테헤란로 1",
  detailAddress: "10층",
  representativePhone: "02-1234-5678",
  contractStartDate: "2026-07-01",
  contractEndDate: "2027-06-30",
  status: "PREPARING" as const,
  version: 1,
  createdAt: "2026-07-16T00:00:00.000Z",
  updatedAt: "2026-07-16T00:00:00.000Z",
};

export function HotelDetailStory() {
  return (
    <HotelShell
      currentPath={`/hotels/${hotel.id}`}
      hotelName={hotel.name}
      principal={{
        companyId: "10000000-0000-4000-8000-000000000001",
        displayName: "호텔 관리자",
        identityId: "20000000-0000-4000-8000-000000000001",
        sessionId: "30000000-0000-4000-8000-000000000001",
        userId: "40000000-0000-4000-8000-000000000001",
        userType: "INTERNAL_STAFF",
      }}
    >
      <HotelDetailView result={{ ok: true, hotel }} />
    </HotelShell>
  );
}
