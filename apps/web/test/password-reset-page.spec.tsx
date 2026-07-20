import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const resetCookie = vi.hoisted(() => ({ pending: false, present: true }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    has: (name: string) => name === "__Host-hotel_password_reset_exchange_pending"
      ? resetCookie.pending
      : resetCookie.present,
  })),
}));

import PasswordSetPage from "../app/password/set/page";

beforeEach(() => {
  resetCookie.present = true;
  resetCookie.pending = false;
});

describe("password set page", () => {
  it("does not render the form before the client checks for a newer fragment", async () => {
    const html = renderToStaticMarkup(await PasswordSetPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("새 비밀번호 설정");
    expect(html).toContain("재설정 링크를 안전하게 확인하고 있습니다");
    expect(html).not.toContain("action=\"/api/auth/password/set\"");
    expect(html).not.toContain("name=\"code\"");
    expect(html).not.toContain("name=\"userID\"");
  });

  it("hides the form for a terminal invalid link", async () => {
    const invalid = renderToStaticMarkup(await PasswordSetPage({
      searchParams: Promise.resolve({ error: "invalid-link" }),
    }));
    expect(invalid).toContain("만료되었거나 올바르지 않습니다");
    expect(invalid).toContain("href=\"/login\"");
    expect(invalid).not.toContain("type=\"password\"");
  });

  it("keeps the form disabled while a fragment exchange is pending", async () => {
    resetCookie.pending = true;
    const pending = renderToStaticMarkup(await PasswordSetPage({ searchParams: Promise.resolve({}) }));
    expect(pending).toContain("만료되었거나 올바르지 않습니다");
    expect(pending).not.toContain("type=\"password\"");
  });

  it("does not reactivate a stale reset cookie after exchange network failure", async () => {
    const unavailable = renderToStaticMarkup(await PasswordSetPage({
      searchParams: Promise.resolve({ error: "exchange-unavailable" }),
    }));
    expect(unavailable).toContain("재설정 링크를 확인할 수 없습니다");
    expect(unavailable).not.toContain("type=\"password\"");
  });

  it("does not allow a query parameter to fabricate success", async () => {
    resetCookie.present = false;
    const html = renderToStaticMarkup(await PasswordSetPage({
      searchParams: Promise.resolve({ success: "1" }),
    }));
    expect(html).toContain("재설정 링크를 안전하게 확인하고 있습니다");
    expect(html).not.toContain("비밀번호가 변경되었습니다");
    expect(html).not.toContain("type=\"password\"");
  });

  it("keeps a server-confirmed token behind the fragment-check gate after provider rejection", async () => {
    const rejected = renderToStaticMarkup(await PasswordSetPage({
      searchParams: Promise.resolve({ error: "password-rejected" }),
    }));
    expect(rejected).toContain("재설정 링크를 안전하게 확인하고 있습니다");
    expect(rejected).not.toContain("type=\"password\"");
  });

  it("describes the eight-character letter-number-symbol password policy", async () => {
    resetCookie.present = false;
    const html = renderToStaticMarkup(await PasswordSetPage({
      searchParams: Promise.resolve({ error: "password-policy" }),
    }));
    expect(html).toContain("8자 이상");
    expect(html).toContain("영문");
    expect(html).toContain("숫자");
    expect(html).toContain("기호");
  });
});
