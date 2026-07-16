import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LoginPage from "../app/login/page";

describe("login page", () => {
  it("offers only the server-managed ZITADEL login entry", () => {
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).toContain("위아히어 호텔 운영");
    expect(html).toContain("href=\"/api/auth/login\"");
    expect(html).toContain("ZITADEL로 로그인");
    expect(html).not.toContain("type=\"password\"");
    expect(html).not.toContain("회원가입");
  });
});
