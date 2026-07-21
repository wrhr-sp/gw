import type { Account, AccountPermission, AuthenticatedPrincipal } from "@werehere/contracts";
import { describe, expect, it, vi } from "vitest";
import { AccountServiceError, type AccountService } from "../src/accounts/service";
import type { AuthService } from "../src/auth/service";
import { createApp } from "../src/app";

const principal: AuthenticatedPrincipal = {
  companyId: "10000000-0000-4000-8000-000000000001",
  identityId: "30000000-0000-4000-8000-000000000001",
  sessionId: "40000000-0000-4000-8000-000000000001",
  userId: "20000000-0000-4000-8000-000000000001",
  userType: "INTERNAL_STAFF",
  displayName: "Preview 관리자",
};
const account: Account = {
  id: "21000000-0000-4000-8000-000000000001",
  displayName: "김하우스",
  loginName: "housekeeper-01",
  email: "housekeeper-01@example.invalid",
  userType: "HOUSEKEEPING",
  status: "PENDING_SETUP",
  hotelId: "50000000-0000-4000-8000-000000000001",
  version: 1,
  createdAt: "2026-07-19T00:00:00.000Z",
  updatedAt: "2026-07-19T00:00:00.000Z",
};
const body = {
  displayName: account.displayName,
  loginName: account.loginName,
  email: account.email,
  userType: account.userType,
  hotelId: account.hotelId,
  assignmentStartDate: "2026-07-19",
  reason: "Preview 하우스키핑 배정",
  initialPassword: "Strong-Preview-123!",
};
const invalidPasswordFixtures = [
  { value: "a1!aaaa", messages: ["비밀번호는 8자 이상 입력해 주세요."] },
  { value: "A1!AAAAA", messages: ["비밀번호에 영문 소문자를 포함해 주세요."] },
  { value: "aa!aaaaa", messages: ["비밀번호에 숫자를 포함해 주세요."] },
  { value: "aa1aaaaa", messages: ["비밀번호에 기호를 포함해 주세요."] },
  { value: `a1!${"a".repeat(198)}`, messages: ["비밀번호는 200자 이하로 입력해 주세요."] },
  {
    value: "!!!!!!!!",
    messages: ["비밀번호에 영문 소문자를 포함해 주세요.", "비밀번호에 숫자를 포함해 주세요."],
  },
  {
    value: "💡💡💡💡💡💡💡💡",
    messages: ["비밀번호에 영문 소문자를 포함해 주세요.", "비밀번호에 숫자를 포함해 주세요."],
  },
] as const;

function authService(active = true): AuthService {
  return {
    beginLogin: vi.fn(),
    beginCustomLogin: vi.fn(),
    completeLogin: vi.fn(),
    finalizeCustomLogin: vi.fn(),
    logout: vi.fn(async () => true),
    prepareCustomLogin: vi.fn(),
    resolvePrincipal: vi.fn(async () => active ? principal : null),
  } as AuthService;
}

function accountService(overrides: Partial<AccountService> = {}): AccountService {
  return {
    createAccount: vi.fn(async () => ({ status: "CREATED" as const, account })),
    listAccounts: vi.fn(async () => ({
      status: "OK" as const,
      accounts: [account],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    })),
    listEligibleHotels: vi.fn(async () => ({
      status: "OK" as const,
      hotels: [{ id: account.hotelId!, name: "위아히어 강남호텔" }],
    })),
    getAccount: vi.fn(async () => account),
    getCapabilities: vi.fn(async () => ({
      permissions: ["USER_READ", "USER_CREATE"] satisfies AccountPermission[],
    })),
    deactivateAccount: vi.fn(async () => ({ status: "UPDATED" as const, account: { ...account, status: "INACTIVE" as const, version: 2 } })),
    changeInitialPassword: vi.fn(async () => ({ status: "UPDATED" as const })),
    ...overrides,
  };
}

describe("account administration API", () => {
  it("requires an authenticated hotel session", async () => {
    const response = await createApp({ authService: authService(false), accountService: accountService() })
      .request("/api/admin/users");
    expect(response.status).toBe(401);
  });

  it("returns DB-derived account capabilities for SSR guards", async () => {
    const service = accountService();
    const response = await createApp({ authService: authService(), accountService: service })
      .request("/api/admin/users/capabilities", {
        headers: { cookie: "__Host-hotel_session=opaque-session-token" },
      });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { permissions: ["USER_READ", "USER_CREATE"] } });
    expect(service.getCapabilities).toHaveBeenCalledWith(principal);
  });

  it("returns USER_CREATE-scoped eligible hotels without accepting a tenant input", async () => {
    const service = accountService();
    const response = await createApp({ authService: authService(), accountService: service })
      .request("/api/admin/users/eligible-hotels", {
        headers: { cookie: "__Host-hotel_session=opaque-session-token" },
      });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      ok: true,
      data: { hotels: [{ id: account.hotelId!, name: "위아히어 강남호텔" }] },
      error: null,
    });
    expect(service.listEligibleHotels).toHaveBeenCalledWith(principal);
  });

  it("requires authentication for eligible hotels", async () => {
    const response = await createApp({ authService: authService(false), accountService: accountService() })
      .request("/api/admin/users/eligible-hotels");
    expect(response.status).toBe(401);
  });

  it("lists company-scoped accounts", async () => {
    const service = accountService();
    const response = await createApp({ authService: authService(), accountService: service })
      .request("/api/admin/users?userType=HOUSEKEEPING", {
        headers: { cookie: "__Host-hotel_session=opaque-session-token" },
      });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { accounts: [{ id: account.id }] } });
    expect(service.listAccounts).toHaveBeenCalledWith(principal, expect.objectContaining({ userType: "HOUSEKEEPING" }));
  });

  it("maps DB permission DENY results to stable 403 responses", async () => {
    const denied = accountService({
      listAccounts: vi.fn(async () => ({ status: "FORBIDDEN" as const })),
      listEligibleHotels: vi.fn(async () => ({ status: "FORBIDDEN" as const })),
      getAccount: vi.fn(async () => ({ status: "FORBIDDEN" as const })),
      createAccount: vi.fn(async () => { throw new AccountServiceError("FORBIDDEN", 403, false); }),
      deactivateAccount: vi.fn(async () => { throw new AccountServiceError("FORBIDDEN", 403, false); }),
    });
    const app = createApp({ authService: authService(), accountService: denied });
    const headers = { cookie: "__Host-hotel_session=opaque-session-token" };
    const list = await app.request("/api/admin/users", { headers });
    const eligibleHotels = await app.request("/api/admin/users/eligible-hotels", { headers });
    const detail = await app.request(`/api/admin/users/${account.id}`, { headers });
    const create = await app.request("/api/admin/users", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json", "idempotency-key": "denied-create" },
      body: JSON.stringify(body),
    });
    const deactivate = await app.request(`/api/admin/users/${account.id}/deactivate`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json", "idempotency-key": "denied-deactivate" },
      body: JSON.stringify({ version: 1, reason: "권한 차단 검증" }),
    });
    for (const response of [list, eligibleHotels, detail, create, deactivate]) {
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: { code: "FORBIDDEN", retryable: false } });
    }
  });

  it("hides an out-of-tenant account as 404", async () => {
    const service = accountService({ getAccount: vi.fn(async () => null) });
    const response = await createApp({ authService: authService(), accountService: service })
      .request(`/api/admin/users/${account.id}`, {
        headers: { cookie: "__Host-hotel_session=opaque-session-token" },
      });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "ACCOUNT_NOT_FOUND", retryable: false } });
  });

  it("requires an Idempotency-Key and creates a DB read-back account", async () => {
    const app = createApp({ authService: authService(), accountService: accountService() });
    const missingKey = await app.request("/api/admin/users", {
      method: "POST",
      headers: { cookie: "__Host-hotel_session=opaque-session-token", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(missingKey.status).toBe(400);

    const response = await app.request("/api/admin/users", {
      method: "POST",
      headers: {
        cookie: "__Host-hotel_session=opaque-session-token",
        "content-type": "application/json",
        "idempotency-key": "account-create-1",
      },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ data: { account: { id: account.id, status: "PENDING_SETUP" } } });
  });

  it.each(invalidPasswordFixtures)(
    "returns stable Korean create-password field errors",
    async ({ value: initialPassword, messages }) => {
      const service = accountService();
      const response = await createApp({ authService: authService(), accountService: service })
        .request("/api/admin/users", {
          method: "POST",
          headers: {
            cookie: "__Host-hotel_session=opaque-session-token",
            "content-type": "application/json",
            "idempotency-key": "invalid-create-password",
          },
          body: JSON.stringify({ ...body, initialPassword }),
        });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: {
          code: "VALIDATION_ERROR",
          fieldErrors: messages.map((message) => ({ field: "initialPassword", message })),
        },
      });
      expect(service.createAccount).not.toHaveBeenCalled();
    },
  );

  it.each(invalidPasswordFixtures)(
    "returns stable initial-password field errors before service/provider calls",
    async ({ value: newPassword, messages }) => {
      const service = accountService();
      const response = await createApp({ authService: authService(), accountService: service })
        .request("/api/account/initial-password", {
          method: "POST",
          headers: {
            cookie: "__Host-hotel_session=opaque-session-token",
            "content-type": "application/json",
            "idempotency-key": "invalid-initial-password",
          },
          body: JSON.stringify({ newPassword }),
        });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: {
          code: "VALIDATION_ERROR",
          fieldErrors: messages.map((message) => ({ field: "newPassword", message })),
        },
      });
      expect(service.changeInitialPassword).not.toHaveBeenCalled();
    },
  );

  it("maps self-deactivation to a stable safe error", async () => {
    const service = accountService({
      deactivateAccount: vi.fn(async () => {
        const error = new Error("self") as Error & { code: string; httpStatus: number; retryable: boolean };
        Object.assign(error, { code: "ACCOUNT_SELF_DEACTIVATION_FORBIDDEN", httpStatus: 409, retryable: false });
        throw error;
      }),
    });
    const response = await createApp({ authService: authService(), accountService: service })
      .request(`/api/admin/users/${principal.userId}/deactivate`, {
        method: "POST",
        headers: {
          cookie: "__Host-hotel_session=opaque-session-token",
          "content-type": "application/json",
          "idempotency-key": "account-deactivate-1",
        },
        body: JSON.stringify({ version: 1, reason: "잘못된 요청" }),
      });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "ACCOUNT_SELF_DEACTIVATION_FORBIDDEN" } });
  });
});
