import type { AuthenticatedPrincipal } from "@werehere/contracts";
import { createPostgresHotelRepository } from "@werehere/db";
import type { AuthService } from "../src/auth/service";
import { createApp } from "../src/app";
import { createHotelService } from "../src/hotels/service";

const databaseUrl = process.env.TEST_READY_URL;
if (!databaseUrl) throw new Error("TEST_READY_URL is required");

const principal: AuthenticatedPrincipal = {
  companyId: "10000000-0000-0000-0000-000000000001",
  identityId: "30000000-0000-0000-0000-000000000001",
  sessionId: "40000000-0000-0000-0000-000000000001",
  userId: "20000000-0000-0000-0000-000000000001",
  userType: "INTERNAL_STAFF",
  displayName: "호텔 API 통합 관리자",
};
const authService = {
  resolvePrincipal: async () => principal,
} as unknown as AuthService;
const repository = createPostgresHotelRepository(databaseUrl);
const app = createApp({ authService, hotelService: createHotelService(repository) });
const cookie = "__Host-hotel_session=opaque-hotel-api-integration";
const value = {
  branchCode: "TEST-HOTEL-HTTP",
  name: "위아히어 HTTP 통합호텔",
  roadAddress: "서울특별시 중구 세종대로 10",
  detailAddress: "20층",
  representativePhone: "02-9876-5432",
  contractStartDate: "2026-08-01",
  contractEndDate: "2027-07-31",
};

try {
  const createdResponse = await app.request("/api/hotels", {
    method: "POST",
    headers: { cookie, "content-type": "application/json", "idempotency-key": "hotel-http-create-1" },
    body: JSON.stringify(value),
  });
  if (createdResponse.status !== 201) throw new Error(`hotel HTTP create status ${createdResponse.status}`);
  const createdBody = await createdResponse.json() as { data?: { hotel?: { id?: string; status?: string } } };
  const hotelId = createdBody.data?.hotel?.id;
  if (!hotelId || createdBody.data?.hotel?.status !== "PREPARING") {
    throw new Error("hotel HTTP create did not return persisted PREPARING data");
  }

  const replayResponse = await app.request("/api/hotels", {
    method: "POST",
    headers: { cookie, "content-type": "application/json", "idempotency-key": "hotel-http-create-1" },
    body: JSON.stringify(value),
  });
  const replayBody = await replayResponse.json() as { data?: { hotel?: { id?: string } } };
  if (replayResponse.status !== 200 || replayBody.data?.hotel?.id !== hotelId) {
    throw new Error("hotel HTTP idempotency replay did not return the original hotel");
  }

  const detailResponse = await app.request(`/api/hotels/${hotelId}`, { headers: { cookie } });
  const detailBody = await detailResponse.json() as { data?: { hotel?: { roadAddress?: string; version?: number } } };
  if (detailResponse.status !== 200
    || detailBody.data?.hotel?.roadAddress !== value.roadAddress
    || detailBody.data.hotel.version !== 1) {
    throw new Error("hotel HTTP detail did not read back PostgreSQL data");
  }

  const listResponse = await app.request("/api/hotels", { headers: { cookie } });
  const listBody = await listResponse.json() as { data?: { hotels?: Array<{ id: string }> } };
  if (listResponse.status !== 200 || !listBody.data?.hotels?.some((hotel) => hotel.id === hotelId)) {
    throw new Error("hotel HTTP list did not include the committed hotel");
  }

  console.log("HOTEL_API_INTEGRATION_OK");
} finally {
  await repository.close();
}
