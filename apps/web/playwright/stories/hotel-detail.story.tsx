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

const relationshipBase = {
  hotelId: hotel.id,
  endDate: null,
  terminatedAt: null,
  terminationReason: null,
  version: 1,
  createdAt: "2026-07-24T00:00:00.000Z",
  updatedAt: "2026-07-24T00:00:00.000Z",
};

const relationshipInitialData = {
  assignments: [
    {
      ...relationshipBase,
      id: "52000000-0000-4000-8000-000000000001",
      userId: "20000000-0000-4000-8000-000000000010",
      relationshipType: "STAFF" as const,
      assignmentType: "PRIMARY" as const,
      startDate: "2026-07-01",
      reason: "강남호텔 주배정",
      assignee: {
        userId: "20000000-0000-4000-8000-000000000010",
        displayName: "김현장",
        userType: "INTERNAL_STAFF" as const,
      },
    },
    {
      ...relationshipBase,
      id: "52000000-0000-4000-8000-000000000002",
      userId: "20000000-0000-4000-8000-000000000011",
      relationshipType: "HOUSEKEEPING" as const,
      assignmentType: null,
      startDate: "2026-07-05",
      reason: "객실정비 연결",
      assignee: {
        userId: "20000000-0000-4000-8000-000000000011",
        displayName: "박하우스키핑",
        userType: "HOUSEKEEPING" as const,
      },
    },
  ],
  owners: [
    {
      ...relationshipBase,
      id: "53000000-0000-4000-8000-000000000001",
      userId: "20000000-0000-4000-8000-000000000012",
      relationshipType: "OWNER" as const,
      assignmentType: null,
      startDate: "2026-07-01",
      reason: "호텔 소유주",
      version: 7,
      assignee: {
        userId: "20000000-0000-4000-8000-000000000012",
        displayName: "이소유",
        userType: "HOTEL_OWNER" as const,
      },
    },
  ],
  candidates: {
    STAFF: [
      {
        userId: "20000000-0000-4000-8000-000000000013",
        displayName: "최지원",
        userType: "INTERNAL_STAFF" as const,
      },
    ],
    HOUSEKEEPING: [
      {
        userId: "20000000-0000-4000-8000-000000000014",
        displayName: "정객실",
        userType: "HOUSEKEEPING" as const,
      },
    ],
    OWNER: [
      {
        userId: "20000000-0000-4000-8000-000000000015",
        displayName: "한소유후보 장기표시이름 접근성검증",
        userType: "HOTEL_OWNER" as const,
      },
    ],
  },
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
      <HotelDetailView
        relationshipInitialData={relationshipInitialData}
        result={{ ok: true, hotel }}
      />
    </HotelShell>
  );
}
