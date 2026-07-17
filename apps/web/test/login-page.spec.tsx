import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LoginPage from "../app/login/page";

describe("login page", () => {
  it("starts the browser-bound OIDC transaction before collecting credentials", async () => {
    const html = renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("위아히어 호텔 운영");
    expect(html).toContain("href=\"/api/auth/login\"");
    expect(html).toContain("호텔관리 로그인");
    expect(html).not.toContain("type=\"password\"");
    expect(html).not.toContain("ZITADEL");
  });

  it("renders the hotel credential form only for a server-bound auth request and CSRF token", async () => {
    const withoutCsrf = renderToStaticMarkup(await LoginPage({
      searchParams: Promise.resolve({ authRequest: "request-1" }),
    }));
    expect(withoutCsrf).not.toContain("type=\"password\"");

    const html = renderToStaticMarkup(await LoginPage({
      searchParams: Promise.resolve({ authRequest: "request-1", csrf: "c".repeat(43) }),
    }));
    expect(html).toContain("action=\"/api/auth/custom-login\"");
    expect(html).toContain("name=\"authRequest\"");
    expect(html).toContain("name=\"csrf\"");
    expect(html).toContain(`value="${"c".repeat(43)}"`);
    expect(html).toContain("value=\"request-1\"");
    expect(html).toContain("autoComplete=\"username\"");
    expect(html).toContain("autoComplete=\"current-password\"");
    expect(html).not.toContain("ZITADEL");
    expect(html).not.toContain("회원가입");
  });
});
