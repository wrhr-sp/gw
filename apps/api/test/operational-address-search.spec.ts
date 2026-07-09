import { describe, expect, it, vi } from "vitest";
import { appRoutes } from "@gw/shared";
import { app } from "../src/app";
import { searchOperationalAddresses } from "../src/lib/operational-address-search";

const adminHeaders = {
  cookie: "gw_session=dev-session_HR_ADMIN",
};

describe("operational address search", () => {
  it("returns explicit provider configuration guard when address API key is missing", async () => {
    const response = await app.request(
      `${appRoutes.admin.addressSearch}?keyword=${encodeURIComponent("테헤란로")}`,
      { headers: adminHeaders },
      {},
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe("EXTERNAL_ADDRESS_NOT_CONFIGURED");
  });

  it("maps Juso provider rows to the shared address search result shape", async () => {
    let capturedUrl = "";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      capturedUrl = String(input);
      const body = JSON.stringify({
        results: {
          common: { errorCode: "0", errorMessage: "정상", totalCount: "1" },
          juso: [
            {
              roadAddr: "서울특별시 강남구 테헤란로 123",
              jibunAddr: "서울특별시 강남구 역삼동 123",
              zipNo: "06234",
              bdNm: "위아히어빌딩",
              admCd: "1168010100",
              rnMgtSn: "116803122001",
              udrtYn: "0",
              buldMnnm: "123",
              buldSlno: "0",
            },
          ],
        },
      });
      return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
    });

    const result = await searchOperationalAddresses(
      { ADDRESS_SEARCH_API_KEY: "test-key", ADDRESS_SEARCH_API_URL: "https://address.example.test/search" },
      "테헤란로",
      { fetch: fetchMock as unknown as typeof fetch },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.results).toEqual([
      {
        id: "1168010100:116803122001:0:123:0:06234",
        postalCode: "06234",
        roadAddress: "서울특별시 강남구 테헤란로 123",
        jibunAddress: "서울특별시 강남구 역삼동 123",
        buildingName: "위아히어빌딩",
      },
    ]);
    expect(capturedUrl).toContain("confmKey=test-key");
    expect(capturedUrl).toContain("countPerPage=40");
    expect(capturedUrl).toContain(encodeURIComponent("테헤란로"));
  });
});
