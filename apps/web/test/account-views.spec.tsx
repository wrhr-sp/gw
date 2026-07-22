import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  AccountCreateForm,
  accountReadBackMatches,
} from "../components/accounts/account-create-form";
import { AccountDetailView } from "../components/accounts/account-detail-view";
import { AccountListView } from "../components/accounts/account-list-view";
import { InitialPasswordForm } from "../components/accounts/initial-password-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const account = {
  id: "21000000-0000-4000-8000-000000000001",
  displayName: "김하우스",
  loginName: "housekeeper01",
  email: "housekeeper-01@example.invalid",
  userType: "HOUSEKEEPING" as const,
  status: "PENDING_SETUP" as const,
  hotelId: "50000000-0000-4000-8000-000000000001",
  hotelName: "위아히어 강남호텔",
  hotelCode: "GANGNAM-01",
  hotels: [
    {
      id: "50000000-0000-4000-8000-000000000001",
      name: "위아히어 강남호텔",
      code: "GANGNAM-01",
    },
    {
      id: "50000000-0000-4000-8000-000000000002",
      name: "위아히어 부산호텔",
      code: "BUSAN-01",
    },
  ],
  version: 1,
  createdAt: "2026-07-19T00:00:00.000Z",
  updatedAt: "2026-07-19T00:00:00.000Z",
};

const initialPasswordFormSource = readFileSync(
  new URL("../components/accounts/initial-password-form.tsx", import.meta.url),
  "utf8",
);
const accountCreateFormSource = readFileSync(
  new URL("../components/accounts/account-create-form.tsx", import.meta.url),
  "utf8",
);
const accountDetailViewSource = readFileSync(
  new URL("../components/accounts/account-detail-view.tsx", import.meta.url),
  "utf8",
);

describe("account administration views", () => {
  it.each([
    ["id", { id: "21000000-0000-4000-8000-000000000002" }],
    ["displayName", { displayName: "다른 사용자" }],
    ["loginName", { loginName: "differentlogin" }],
    ["email", { email: "different@example.invalid" }],
    ["userType", { userType: "INTERNAL_STAFF" as const }],
    ["hotelIds", { hotels: [account.hotels[0]!] }],
    ["status", { status: "ACTIVE" as const }],
    ["version", { version: 2 }],
  ])("rejects a read-back mismatch in material field %s", (_field, patch) => {
    expect(accountReadBackMatches(account, { ...account, ...patch })).toBe(
      false,
    );
  });

  it("renders real account fields in desktop rows and mobile cards", () => {
    const html = renderToStaticMarkup(
      <AccountListView
        canCreate
        result={{
          ok: true,
          accounts: [account],
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        }}
      />,
    );
    expect(html).toContain("사용자 계정");
    expect(html).toContain("김하우스");
    expect(html).toContain("하우스키핑");
    expect(html).toContain("최초 설정 대기");
    expect(html).toContain("위아히어 강남호텔");
    expect(html).toContain("GANGNAM-01");
    expect(html).toContain("md:hidden");
    expect(html).not.toMatch(/mock|sample|placeholder|Phase|UAT/i);
  });

  it("hides create and suspend actions without their independent capabilities", () => {
    const list = renderToStaticMarkup(
      <AccountListView
        canCreate={false}
        result={{
          ok: true,
          accounts: [account],
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        }}
      />,
    );
    expect(list).not.toContain("사용자 생성");
    const detail = renderToStaticMarkup(
      <AccountDetailView account={account} canSuspend={false} />,
    );
    expect(detail).not.toContain("계정 중지");
  });

  it("renders a hotel name and code instead of an internal UUID", () => {
    const html = renderToStaticMarkup(
      <AccountDetailView account={account} canSuspend={false} />,
    );
    expect(html).toContain("위아히어 강남호텔");
    expect(html).toContain("GANGNAM-01");
    expect(html).toContain("위아히어 부산호텔");
    expect(html).toContain("BUSAN-01");
    expect(html).not.toContain(account.hotelId);
  });

  it("renders a real creation form with no registration-request language", () => {
    const html = renderToStaticMarkup(
      <AccountCreateForm
        hotels={[{ id: account.hotelId, name: "위아히어 강남호텔" }]}
      />,
    );
    for (const label of [
      "표시이름",
      "로그인 아이디",
      "이메일",
      "사용자유형",
      "호텔",
      "임시 비밀번호",
      "배정 시작일",
      "생성 사유",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("/api/admin/users");
    expect(html).toContain('type="password"');
    expect(html).toContain('minLength="8"');
    expect(html).toContain('maxLength="400"');
    expect(html).toContain("영문 소문자, 숫자, 기호");
    expect(html).toContain("200자 이하");
    expect(html).toContain("영문 소문자, 숫자, 기호");
    expect(html).not.toMatch(/회원가입 신청|가입 승인/);
    expect(html).not.toContain("Strong-Preview-123!");
  });

  it("renders searchable filters and pagination links that preserve the active query", () => {
    const html = renderToStaticMarkup(
      <AccountListView
        canCreate
        query={{
          q: "김",
          status: "ACTIVE",
          userType: "HOUSEKEEPING",
        }}
        result={{
          ok: true,
          accounts: [account],
          pagination: { page: 2, pageSize: 20, total: 41, totalPages: 3 },
        }}
      />,
    );
    expect(html).toContain("사용자 검색");
    expect(html).toContain("상태 필터");
    expect(html).toContain("사용자유형 필터");
    expect(html).toContain("page=1");
    expect(html).toContain("page=3");
    expect(html).toContain("q=%EA%B9%80");
  });

  it("distinguishes filtered empty, creatable empty, and read-only empty account lists", () => {
    const filtered = renderToStaticMarkup(
      <AccountListView
        canCreate
        query={{ q: "없는사용자" }}
        result={{
          ok: true,
          accounts: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        }}
      />,
    );
    expect(filtered).toContain("검색 조건에 맞는 사용자가 없습니다");
    expect(filtered).toContain("필터 초기화");
    expect(filtered).not.toContain("첫 사용자를 생성");
    const creatable = renderToStaticMarkup(
      <AccountListView
        canCreate
        result={{
          ok: true,
          accounts: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        }}
      />,
    );
    expect(creatable).toContain("생성된 사용자 계정이 없습니다");
    const readOnly = renderToStaticMarkup(
      <AccountListView
        canCreate={false}
        result={{
          ok: true,
          accounts: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        }}
      />,
    );
    expect(readOnly).toContain("조회 가능한 사용자 계정이 없습니다");
  });

  it("renders forced initial password change without exposing a temporary password", () => {
    const html = renderToStaticMarkup(<InitialPasswordForm />);
    expect(html).toContain("새 비밀번호");
    expect(html).toContain("새 비밀번호 확인");
    expect(html).toContain("/api/account/initial-password");
    expect(html).toContain("다른 계정으로 로그인");
    expect(initialPasswordFormSource).toContain('aria-required="true"');
    expect(initialPasswordFormSource).toContain(
      "formErrorRef.current?.focus()",
    );
    expect(initialPasswordFormSource).toContain("tabIndex={-1}");
    expect(initialPasswordFormSource).toContain("fieldError");
    expect(initialPasswordFormSource).toContain("fieldErrors.find(");
    expect(initialPasswordFormSource).toContain(
      'error.field === "newPassword"',
    );
    expect(initialPasswordFormSource).toContain("setFormError(null)");
    expect(initialPasswordFormSource).toContain("idempotency-key");
    expect(html.match(/type="password"/g)).toHaveLength(2);
    expect(html.match(/minLength="8"/g)).toHaveLength(2);
    expect(html.match(/maxLength="400"/g)).toHaveLength(2);
    expect(html).toContain("영문 소문자, 숫자, 기호");
    expect(html).toContain("200자 이하");
    expect(html).toContain("영문 소문자, 숫자, 기호");
    expect(html).not.toContain("Strong-Preview-123!");
  });

  it("reuses one idempotency key while retrying the same initial password payload", () => {
    expect(initialPasswordFormSource).toContain("useRef");
    expect(initialPasswordFormSource).toContain("/api/auth/logout");
    expect(initialPasswordFormSource).toMatch(
      /idempotency-key["']:\s*idempotencyKeyRef\.current/u,
    );
    expect(initialPasswordFormSource).not.toMatch(
      /idempotency-key["']:\s*crypto\.randomUUID\(\)/u,
    );
  });

  it("links account create errors and moves focus to the first server field error", () => {
    expect(accountCreateFormSource).toContain("aria-describedby");
    expect(accountCreateFormSource).toContain("serverErrorField");
    expect(accountCreateFormSource).toMatch(/setFocus\(serverErrorField\)/u);
    expect(accountCreateFormSource).toContain(
      "작성 중인 내용을 폐기하시겠습니까?",
    );
    expect(accountCreateFormSource).toContain("<dialog");
    expect(accountCreateFormSource).toContain('role="alertdialog"');
    expect(accountCreateFormSource).toContain('aria-required="true"');
    expect(accountCreateFormSource).toContain("formErrorRef.current?.focus()");
    expect(accountCreateFormSource).toContain("firstHotelRef.current?.focus()");
    expect(accountCreateFormSource).toContain("onCancel");
    expect(accountCreateFormSource).toContain('register("hotelIds"');
    expect(accountCreateFormSource).toContain('userType === "HOUSEKEEPING"');
    expect(accountCreateFormSource).toContain("clearErrors(names)");
    expect(accountCreateFormSource).toContain("setFormError(null)");
    expect(accountCreateFormSource).toContain(
      "onChange: () => clearStaleErrors(name)",
    );
  });

  it("distinguishes authorization failures from account-list server failures", () => {
    const html = renderToStaticMarkup(
      <AccountListView
        canCreate={false}
        result={{
          ok: false,
          error: { code: "INTERNAL_ERROR", message: "일시적인 오류입니다." },
        }}
      />,
    );
    expect(html).toContain("사용자 계정을 불러오지 못했습니다");
    expect(html).not.toContain("관리 권한이 없습니다");
  });

  it("focuses invalid initial password input and exposes an error description", () => {
    expect(initialPasswordFormSource).toContain("aria-describedby");
    expect(initialPasswordFormSource).toContain(
      "confirmationRef.current?.focus()",
    );
  });

  it("keeps a server new-password error owned by only that field", () => {
    expect(initialPasswordFormSource).toMatch(
      /setFieldError\(\{[\s\S]+clearOn: "newPassword",[\s\S]+target: "newPassword",[\s\S]+\}\)/u,
    );
    expect(initialPasswordFormSource).toContain(
      'id="initial-password-new-error"',
    );
    expect(initialPasswordFormSource).toContain(
      'id="initial-password-confirmation-error"',
    );
    expect(initialPasswordFormSource).not.toContain(
      'id="initial-password-field-error"',
    );
    expect(initialPasswordFormSource).toMatch(
      /setConfirmation\([\s\S]+if \(fieldError\?\.clearOn === "either"\)/u,
    );
  });

  it("requires shared suspension validation, generic error focus, explicit confirmation, and one retry key", () => {
    expect(accountDetailViewSource).toContain(
      "deactivateAccountRequestSchema.safeParse",
    );
    expect(accountDetailViewSource).toContain("formErrorRef.current?.focus()");
    expect(accountDetailViewSource).toContain("tabIndex={-1}");
    expect(accountDetailViewSource).toContain("reasonError");
    expect(accountDetailViewSource).toContain("중지하시겠습니까?");
    expect(accountDetailViewSource).toContain("idempotencyKeyRef");
    expect(accountDetailViewSource).not.toMatch(
      /idempotency-key["']:\s*crypto\.randomUUID\(\)/u,
    );
  });
});
