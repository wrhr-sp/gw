import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewHotelPage from "../app/hotels/new/page";
import { fetchHotelList } from "../lib/server-hotels";

vi.mock("../lib/server-hotels", () => ({
  fetchHotelList: vi.fn(),
}));

const mockedFetchHotelList = vi.mocked(fetchHotelList);

describe("new hotel page access failure", () => {
  beforeEach(() => {
    mockedFetchHotelList.mockReset();
  });

  it("offers retry when the access API is temporarily unavailable", async () => {
    mockedFetchHotelList.mockResolvedValue({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "호텔 API에 연결할 수 없습니다.",
        status: 503,
      },
    });

    const html = renderToStaticMarkup(await NewHotelPage());
    expect(html).toContain("호텔 등록 화면을 열 수 없습니다");
    expect(html).toContain('href="/hotels/new"');
    expect(html).toContain("다시 시도");
  });

  it("does not offer retry for a permission denial", async () => {
    mockedFetchHotelList.mockResolvedValue({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "호텔 관리 권한이 없습니다.",
        status: 403,
      },
    });

    const html = renderToStaticMarkup(await NewHotelPage());
    expect(html).toContain("호텔 등록 권한이 없습니다");
    expect(html).not.toContain('href="/hotels/new"');
  });
});
