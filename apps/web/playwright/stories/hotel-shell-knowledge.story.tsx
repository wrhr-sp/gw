import { HotelShell } from "../../components/hotels/hotel-shell";

export function HotelShellKnowledgeStory() {
  return (
    <HotelShell
      currentPath="/hotel-operations"
      principal={{
        companyId: "11111111-1111-4111-8111-111111111111",
        displayName: "호텔 운영자",
        identityId: "22222222-2222-4222-8222-222222222222",
        sessionId: "33333333-3333-4333-8333-333333333333",
        userId: "44444444-4444-4444-8444-444444444444",
        userType: "INTERNAL_STAFF",
      }}
    >
      <h1>호텔 운영</h1>
    </HotelShell>
  );
}
