import { HotelListView } from "../../components/hotels/hotel-list-view";
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

export function HotelListStory() {
  return (
    <HotelShell
      currentPath="/hotels"
      principal={{
        companyId: "10000000-0000-4000-8000-000000000001",
        displayName: "호텔 관리자",
        identityId: "20000000-0000-4000-8000-000000000001",
        sessionId: "30000000-0000-4000-8000-000000000001",
        userId: "40000000-0000-4000-8000-000000000001",
        userType: "INTERNAL_STAFF",
      }}
    >
      <HotelListView
        query={{ page: 1, pageSize: 20 }}
        result={{
          ok: true,
          capabilities: { canCreate: true },
          hotels: [hotel, { ...hotel, id: "50000000-0000-4000-8000-000000000002", branchCode: "HOTEL-JJ", name: "위아히어 전주호텔", roadAddress: "전북특별자치도 전주시 완산구 온고을로 2", status: "ACTIVE" }],
          pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
        }}
      />
    </HotelShell>
  );
}
