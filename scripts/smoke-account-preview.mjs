import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
import {
  assertCreateResponseMatchesAttempt,
  assertHousekeepingAssignmentRows,
  discoverCleanupAttempt,
  ensureDatabaseInactive,
  finalizePreviewSmoke,
  orchestratePreviewAccountCleanup,
  waitForProviderInactive,
  waitForProviderSessionGone,
  waitForZeroActiveSessions,
} from "./lib/preview-account-smoke-cleanup.mjs";

const requireFromDb = createRequire(
  new URL("../packages/db/package.json", import.meta.url),
);
const postgres = requireFromDb("postgres");

const baseUrl = process.env.WEB_PREVIEW_URL?.trim().replace(/\/+$/u, "");
const bootstrapSubject = process.env.ZITADEL_PREVIEW_SUBJECT?.trim();
const issuer = process.env.ZITADEL_ISSUER?.trim().replace(/\/+$/u, "");
const organizationId = process.env.ZITADEL_ORGANIZATION_ID?.trim();
const provisionerToken = process.env.ZITADEL_USER_PROVISIONER_TOKEN?.trim();
const verificationToken = process.env.ZITADEL_SERVICE_USER_TOKEN?.trim();
const apiUrlFile = process.env.API_RUNTIME_DATABASE_URL_FILE?.trim();
const reconcilerUrlFile = process.env.RECONCILER_DATABASE_URL_FILE?.trim();
const runId = process.env.GITHUB_RUN_ID?.trim();
const runAttempt = process.env.GITHUB_RUN_ATTEMPT?.trim();

if (!baseUrl?.startsWith("https://")) {
  throw new Error("WEB_PREVIEW_URL must be an HTTPS URL");
}
for (const [name, value] of Object.entries({
  ZITADEL_PREVIEW_SUBJECT: bootstrapSubject,
  ZITADEL_ISSUER: issuer,
  ZITADEL_ORGANIZATION_ID: organizationId,
  ZITADEL_USER_PROVISIONER_TOKEN: provisionerToken,
  ZITADEL_SERVICE_USER_TOKEN: verificationToken,
  API_RUNTIME_DATABASE_URL_FILE: apiUrlFile,
  RECONCILER_DATABASE_URL_FILE: reconcilerUrlFile,
  GITHUB_RUN_ID: runId,
  GITHUB_RUN_ATTEMPT: runAttempt,
})) {
  if (!value) throw new Error(`${name} is required for account Preview smoke`);
}

const apiDatabaseUrl = (await readFile(apiUrlFile, "utf8")).trim();
const reconcilerDatabaseUrl = (
  await readFile(reconcilerUrlFile, "utf8")
).trim();
const apiSql = postgres(apiDatabaseUrl, { max: 1, prepare: false });
const reconcilerSql = postgres(reconcilerDatabaseUrl, {
  max: 1,
  prepare: false,
});
const cookieName = "__Host-hotel_session";
const runSuffix = `${runId}${runAttempt}`
  .replace(/[^A-Za-z0-9]/gu, "")
  .toLowerCase();
const loginName = `p${runSuffix}`.slice(0, 30);
const email = `${loginName}@werehere.invalid`;
const displayName = `Preview 검증 ${runSuffix}`.slice(0, 100);
const assignmentStartDate = new Date().toISOString().slice(0, 10);
const assignmentReason = "Preview release 실제 계정 흐름 검증";
const accountCreateIdempotencyKey = `preview-account-create-${runSuffix}`;
const initialPassword = `preview-a1!-${randomBytes(18).toString("base64url")}`;
const changedPassword = `changed-a1!-${randomBytes(18).toString("base64url")}`;
let adminToken;
let adminPrincipal;
let account;
let accountCreateRequestStarted = false;
let pendingSession;
let providerSubject;
let providerVerificationSession;
let providerVerificationSessionCreationIndeterminate = false;
let journeyError;

function tokenHash(token) {
  return createHash("sha256").update(token, "utf8").digest();
}

async function createSession(providerSubjectValue) {
  const token = randomBytes(32).toString("base64url");
  const rows = await apiSql`
    select * from public.auth_create_session_v2(
      ${randomUUID()}::uuid,
      ${tokenHash(token)},
      ${providerSubjectValue},
      28800,
      86400,
      statement_timestamp(),
      ${randomUUID()}::uuid
    )
  `;
  if (rows.length !== 1 || rows[0]?.result_status !== "CREATED") {
    throw new Error("Preview smoke session could not be created");
  }
  return {
    token,
    principal: {
      companyId: rows[0].company_id,
      sessionId: rows[0].session_id,
      userId: rows[0].user_id,
    },
  };
}

async function api(
  path,
  {
    body,
    expectedStatuses = [200],
    idempotencyKey,
    method = "GET",
    token,
  } = {},
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      ...(token ? { cookie: `${cookieName}=${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!expectedStatuses.includes(response.status)) {
    let code = "UNKNOWN";
    if (response.headers.get("content-type")?.includes("application/json")) {
      try {
        const parsed = await response.clone().json();
        if (typeof parsed?.error?.code === "string") code = parsed.error.code;
      } catch {
        // Status and stable error code are the only diagnostics; bodies may contain sensitive data.
      }
    }
    throw new Error(
      `Account Preview smoke ${path} failed with ${response.status} (${code})`,
    );
  }
  if (response.status === 204) return null;
  return response.json();
}

async function provider(
  path,
  {
    acceptableStatuses = [200],
    body,
    includeStatus = false,
    method = "GET",
    token = provisionerToken,
  } = {},
) {
  const response = await fetch(`${issuer}${path}`, {
    method,
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!acceptableStatuses.includes(response.status)) {
    throw new Error(
      `Identity provider Preview smoke failed at ${method} ${path.split("/").slice(0, 3).join("/")} (${response.status})`,
    );
  }
  let data = null;
  if (
    response.status !== 204 &&
    response.headers.get("content-type")?.includes("application/json")
  ) {
    data = await response.json();
  }
  return includeStatus ? { data, status: response.status } : data;
}

async function providerSubjectFor(companyId, userId) {
  return reconcilerSql.begin(async (sql) => {
    await sql`select set_config('app.reconciler_company_id', ${companyId}, true)`;
    const rows = await sql`
      select distinct provider_subject
      from (
        select provider_subject
        from public.auth_identities
        where company_id = ${companyId}::uuid
          and user_id = ${userId}::uuid
          and provider = 'ZITADEL'
        union all
        select provider_subject
        from public.account_provisioning_attempts
        where company_id = ${companyId}::uuid
          and target_user_id = ${userId}::uuid
          and provider_subject is not null
      ) provider_subjects
    `;
    if (rows.length !== 1 || !rows[0]?.provider_subject) {
      throw new Error("Created account provider identity read-back failed");
    }
    return rows[0].provider_subject;
  });
}

async function accountCleanupState(companyId, userId, expectedLoginName) {
  return reconcilerSql.begin(async (sql) => {
    await sql`select set_config('app.reconciler_company_id', ${companyId}, true)`;
    const rows = await sql`
      select id, login_name, version, status
      from public.users
      where company_id = ${companyId}::uuid
        and id = ${userId}::uuid
    `;
    if (
      rows.length !== 1 ||
      !Number.isInteger(rows[0]?.version) ||
      rows[0]?.login_name !== expectedLoginName
    ) {
      throw new Error("Preview account cleanup state read-back failed");
    }
    return rows[0];
  });
}

async function accountCleanupAttempt(companyId, actorUserId) {
  return reconcilerSql.begin(async (sql) => {
    await sql`select set_config('app.reconciler_company_id', ${companyId}, true)`;
    const rows = await sql`
      select attempt.target_user_id as id,
             attempt.status as attempt_status,
             attempt.provider_subject,
             attempt.completion_payload->>'loginName' as request_login_name,
             attempt.completion_payload->>'email' as request_email,
             target.status as user_status,
             target.version as user_version
      from public.account_provisioning_attempts attempt
      left join public.users target
        on target.company_id = attempt.company_id
       and target.id = attempt.target_user_id
      where attempt.company_id = ${companyId}::uuid
        and attempt.actor_user_id = ${actorUserId}::uuid
        and attempt.idempotency_key = ${accountCreateIdempotencyKey}
    `;
    if (rows.length > 1) {
      throw new Error("Preview account cleanup attempt was ambiguous");
    }
    const row = rows[0];
    return row
      ? {
          id: row.id,
          attemptStatus: row.attempt_status,
          providerSubject: row.provider_subject,
          requestEmail: row.request_email,
          requestLoginName: row.request_login_name,
          userStatus: row.user_status ?? null,
          userVersion: row.user_version ?? null,
        }
      : undefined;
  });
}

async function deactivateProviderForCleanup(subject) {
  await provider(`/v2/users/${encodeURIComponent(subject)}/deactivate`, {
    acceptableStatuses: [200, 204, 404],
    body: {},
    method: "POST",
  });
}

async function providerUserForCleanup(subject) {
  const result = await provider(`/v2/users/${encodeURIComponent(subject)}`, {
    acceptableStatuses: [200, 404],
    includeStatus: true,
  });
  return result.status === 404 ? { absent: true } : result.data;
}

async function providerVerificationSessionStatus(session) {
  const result = await provider(
    `/v2/sessions/${encodeURIComponent(session.id)}`,
    {
      acceptableStatuses: [200, 401, 404],
      includeStatus: true,
      token: session.token,
    },
  );
  return result.status;
}

async function assertHousekeepingAssignments(
  companyId,
  userId,
  expectedHotelIds,
) {
  return reconcilerSql.begin(async (sql) => {
    await sql`select set_config('app.reconciler_company_id', ${companyId}, true)`;
    const rows = await sql`
      select branch_id, start_date::text as start_date, reason
      from public.housekeeping_hotel_links
      where company_id = ${companyId}::uuid
        and user_id = ${userId}::uuid
        and end_date is null
      order by branch_id
    `;
    assertHousekeepingAssignmentRows(rows, {
      expectedHotelIds,
      expectedReason: assignmentReason,
      expectedStartDate: assignmentStartDate,
    });
  });
}

async function activeSessionCount(sessionId, companyId, userId) {
  return apiSql.begin(async (sql) => {
    await sql`select set_config('app.session_id', ${sessionId}, true)`;
    const [row] = await sql`
      select public.api_current_company_id() as context_company_id,
             (
               select count(*)::integer
               from public.auth_sessions
               where company_id = ${companyId}::uuid
                 and user_id = ${userId}::uuid
                 and revoked_at is null
                 and idle_expires_at > statement_timestamp()
                 and absolute_expires_at > statement_timestamp()
             ) as count
    `;
    if (row?.context_company_id !== companyId) {
      throw new Error("Preview session read-back tenant context was invalid");
    }
    return row?.count;
  });
}

async function verifyHostedCustomLogin({
  expectedUserId,
  loginId,
  password,
  shouldAuthenticate,
}) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${baseUrl}/api/auth/login`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForURL((candidate) =>
      candidate.origin === new URL(baseUrl).origin &&
      candidate.pathname === "/login" &&
      /^[A-Za-z0-9_-]{1,200}$/u.test(candidate.searchParams.get("authRequest") ?? "") &&
      /^[A-Za-z0-9_-]{43}$/u.test(candidate.searchParams.get("csrf") ?? ""),
    { timeout: 60_000 });
    const loginInput = page.locator("#login-name");
    await loginInput.evaluate((element) => element.removeAttribute("pattern"));
    await loginInput.fill(loginId);
    await page.locator("#login-password").fill(password);
    await page.getByRole("button", { name: "로그인" }).click();

    if (!shouldAuthenticate) {
      await page.waitForURL((candidate) =>
        candidate.origin === new URL(baseUrl).origin &&
        candidate.pathname === "/login" &&
        candidate.searchParams.get("error") === "invalid-credentials",
      { timeout: 60_000 });
      const rejectedCookies = await context.cookies(baseUrl);
      if (rejectedCookies.some((cookie) => cookie.name === cookieName)) {
        throw new Error("Rejected legacy login alias issued a hotel session");
      }
      return;
    }

    await page.waitForURL((candidate) =>
      candidate.origin === new URL(baseUrl).origin &&
      !candidate.pathname.startsWith("/api/auth") &&
      candidate.pathname !== "/login",
    { timeout: 60_000 });
    const sessionResponse = await context.request.get(`${baseUrl}/api/auth/session`, {
      headers: { accept: "application/json" },
    });
    if (sessionResponse.status() !== 200) {
      throw new Error("Hosted canonical login did not issue a readable hotel session");
    }
    const sessionBody = await sessionResponse.json();
    if (
      sessionBody?.data?.authenticated !== true ||
      sessionBody.data?.principal?.userId !== expectedUserId
    ) {
      throw new Error("Hosted canonical login resolved an unexpected internal user");
    }
  } finally {
    await browser.close();
  }
}

try {
  const adminSession = await createSession(bootstrapSubject);
  adminToken = adminSession.token;
  adminPrincipal = adminSession.principal;

  let eligible = await api("/api/admin/users/eligible-hotels", {
    token: adminToken,
  });
  let eligibleHotels = eligible?.data?.hotels ?? [];
  for (let slot = eligibleHotels.length; slot < 2; slot += 1) {
    const hotelNumber = slot + 1;
    await api("/api/hotels", {
      method: "POST",
      token: adminToken,
      idempotencyKey: `preview-account-smoke-hotel-v${hotelNumber}`,
      expectedStatuses: [200, 201],
      body: {
        branchCode: `PREVIEW_SMOKE_${hotelNumber}`,
        name: `Preview 계정검증 호텔 ${hotelNumber}`,
        roadAddress: `서울특별시 중구 세종대로 ${hotelNumber}`,
        detailAddress: "",
        representativePhone: `02-1234-567${hotelNumber}`,
        contractStartDate: "2026-01-01",
        contractEndDate: "2099-12-31",
      },
    });
    eligible = await api("/api/admin/users/eligible-hotels", {
      token: adminToken,
    });
    eligibleHotels = eligible?.data?.hotels ?? [];
  }
  const hotelIds = eligibleHotels
    .slice(0, 2)
    .map((hotel) => hotel.id)
    .sort();
  if (hotelIds.length !== 2 || new Set(hotelIds).size !== 2) {
    throw new Error("Preview smoke requires two distinct eligible hotels");
  }

  accountCreateRequestStarted = true;
  const created = await api("/api/admin/users", {
    method: "POST",
    token: adminToken,
    idempotencyKey: accountCreateIdempotencyKey,
    expectedStatuses: [200, 201],
    body: {
      displayName,
      loginName,
      email,
      userType: "HOUSEKEEPING",
      hotelIds,
      assignmentStartDate,
      reason: assignmentReason,
      initialPassword,
    },
  });
  account = created?.data?.account;
  const createAttempt = await discoverCleanupAttempt({
    attempts: 6,
    expectedEmail: email,
    expectedLoginName: loginName,
    read: () =>
      accountCleanupAttempt(
        adminSession.principal.companyId,
        adminSession.principal.userId,
      ),
    waitMilliseconds: 5_000,
  });
  account = assertCreateResponseMatchesAttempt(account, createAttempt);
  const createdHotelIds = (account?.hotels ?? [])
    .map((hotel) => hotel.id)
    .sort();
  if (
    !account?.id ||
    account.status !== "PENDING_SETUP" ||
    account.displayName !== displayName ||
    account.loginName !== loginName ||
    account.email !== email ||
    account.userType !== "HOUSEKEEPING" ||
    account.hotelId !== null ||
    JSON.stringify(createdHotelIds) !== JSON.stringify(hotelIds)
  ) {
    throw new Error("Created Preview account response was invalid");
  }

  const detail = await api(
    `/api/admin/users/${encodeURIComponent(account.id)}`,
    {
      token: adminToken,
    },
  );
  const detailAccount = detail?.data?.account;
  const detailHotelIds = (detailAccount?.hotels ?? [])
    .map((hotel) => hotel.id)
    .sort();
  if (
    detailAccount?.id !== account.id ||
    detailAccount.version !== account.version ||
    detailAccount.displayName !== displayName ||
    detailAccount.loginName !== loginName ||
    detailAccount.email !== email ||
    detailAccount.userType !== "HOUSEKEEPING" ||
    detailAccount.status !== "PENDING_SETUP" ||
    detailAccount.hotelId !== null ||
    JSON.stringify(detailHotelIds) !== JSON.stringify(hotelIds)
  ) {
    throw new Error("Created Preview account PostgreSQL GET read-back failed");
  }

  await assertHousekeepingAssignments(
    adminSession.principal.companyId,
    account.id,
    hotelIds,
  );

  providerSubject = await providerSubjectFor(
    adminSession.principal.companyId,
    account.id,
  );
  if (providerSubject !== createAttempt.providerSubject) {
    throw new Error(
      "Created account provider subject did not match durable target",
    );
  }
  pendingSession = await createSession(providerSubject);
  await api("/api/account/initial-password", {
    method: "POST",
    token: pendingSession.token,
    idempotencyKey: `preview-initial-password-${runSuffix}`,
    expectedStatuses: [204],
    body: { newPassword: changedPassword },
  });
  const activatedDetail = await api(
    `/api/admin/users/${encodeURIComponent(account.id)}`,
    { token: adminToken },
  );
  const activatedAccount = activatedDetail?.data?.account;
  if (
    activatedAccount?.id !== createAttempt.id ||
    activatedAccount.status !== "ACTIVE" ||
    activatedAccount.mustChangePassword !== false
  ) {
    throw new Error("Initial password change PostgreSQL read-back failed");
  }
  account = activatedAccount;

  await verifyHostedCustomLogin({
    expectedUserId: account.id,
    loginId: loginName,
    password: changedPassword,
    shouldAuthenticate: true,
  });
  const legacyAlias = `${loginName.slice(0, -1)}-${loginName.slice(-1)}`;
  await verifyHostedCustomLogin({
    expectedUserId: account.id,
    loginId: legacyAlias,
    password: changedPassword,
    shouldAuthenticate: false,
  });

  providerVerificationSessionCreationIndeterminate = true;
  const providerSession = await provider("/v2/sessions", {
    method: "POST",
    token: verificationToken,
    body: {
      checks: {
        user: { userId: providerSubject },
        password: { password: changedPassword },
      },
      lifetime: "60s",
    },
  });
  providerVerificationSession = {
    id: providerSession?.sessionId,
    token: providerSession?.sessionToken,
  };
  if (!providerVerificationSession.id || !providerVerificationSession.token) {
    throw new Error(
      "Provider credential session creation response was invalid",
    );
  }
  providerVerificationSessionCreationIndeterminate = false;
  const providerSessionReadBack = await provider(
    `/v2/sessions/${encodeURIComponent(providerVerificationSession.id)}`,
    { token: providerVerificationSession.token },
  );
  if (
    providerSessionReadBack?.session?.id !== providerVerificationSession.id ||
    providerSessionReadBack.session?.factors?.user?.id !== providerSubject ||
    providerSessionReadBack.session?.factors?.user?.organizationId !==
      organizationId
  ) {
    throw new Error(
      "Provider credential session read-back did not match the created account",
    );
  }
  await provider(
    `/v2/sessions/${encodeURIComponent(providerVerificationSession.id)}`,
    {
      method: "DELETE",
      token: verificationToken,
      acceptableStatuses: [200, 204],
      body: { sessionToken: providerVerificationSession.token },
    },
  );
  await waitForProviderSessionGone({
    attempts: 12,
    read: () => providerVerificationSessionStatus(providerVerificationSession),
    waitMilliseconds: 5_000,
  });
  providerVerificationSession = undefined;

  const deactivated = await api(
    `/api/admin/users/${encodeURIComponent(account.id)}/deactivate`,
    {
      method: "POST",
      token: adminToken,
      idempotencyKey: `preview-account-deactivate-${runSuffix}`,
      body: {
        version: account.version,
        reason: "Preview release 실제 비활성화 검증",
      },
    },
  );
  account = deactivated?.data?.account;
  if (account?.status !== "INACTIVE") {
    throw new Error("Preview account did not become inactive");
  }

  const inactiveDetail = await api(
    `/api/admin/users/${encodeURIComponent(account.id)}`,
    {
      token: adminToken,
    },
  );
  if (inactiveDetail?.data?.account?.status !== "INACTIVE") {
    throw new Error("Inactive Preview account PostgreSQL read-back failed");
  }
  await waitForProviderInactive({
    attempts: 24,
    expectedOrganizationId: organizationId,
    expectedSubject: providerSubject,
    read: () => provider(`/v2/users/${encodeURIComponent(providerSubject)}`),
    waitMilliseconds: 5_000,
  });
  await waitForZeroActiveSessions({
    attempts: 6,
    read: () =>
      activeSessionCount(
        adminSession.principal.sessionId,
        adminSession.principal.companyId,
        account.id,
      ),
    waitMilliseconds: 5_000,
  });
  await api("/api/auth/session", {
    token: pendingSession.token,
    expectedStatuses: [401],
  });
} catch (error) {
  journeyError = error;
}

let cleanupFailed = providerVerificationSessionCreationIndeterminate;
if (providerVerificationSession?.id && providerVerificationSession.token) {
  try {
    await provider(
      `/v2/sessions/${encodeURIComponent(providerVerificationSession.id)}`,
      {
        method: "DELETE",
        token: verificationToken,
        acceptableStatuses: [200, 204, 404],
        body: { sessionToken: providerVerificationSession.token },
      },
    );
    await waitForProviderSessionGone({
      attempts: 12,
      read: () =>
        providerVerificationSessionStatus(providerVerificationSession),
      waitMilliseconds: 5_000,
    });
  } catch {
    cleanupFailed = true;
  }
}
if (adminToken && adminPrincipal?.companyId && adminPrincipal.userId) {
  try {
    const responseAccountId = account?.id;
    await orchestratePreviewAccountCleanup({
      cleanupDatabase: async (targetId) => {
        await ensureDatabaseInactive({
          attempts: 6,
          deactivate: (state) =>
            api(`/api/admin/users/${encodeURIComponent(targetId)}/deactivate`, {
              method: "POST",
              token: adminToken,
              idempotencyKey: `preview-account-cleanup-${runSuffix}`,
              body: {
                version: state.version,
                reason: "Preview release 실패 검증 계정 정리",
              },
            }),
          read: () =>
            accountCleanupState(adminPrincipal.companyId, targetId, loginName),
          waitMilliseconds: 5_000,
        });
        await waitForZeroActiveSessions({
          attempts: 6,
          read: () =>
            activeSessionCount(
              adminPrincipal.sessionId,
              adminPrincipal.companyId,
              targetId,
            ),
          waitMilliseconds: 5_000,
        });
        if (pendingSession?.token) {
          await api("/api/auth/session", {
            token: pendingSession.token,
            expectedStatuses: [401],
          });
        }
      },
      cleanupProvider: async (subject) => {
        await waitForProviderInactive({
          allowAbsent: true,
          attempts: 24,
          deactivate: () => deactivateProviderForCleanup(subject),
          expectedOrganizationId: organizationId,
          expectedSubject: subject,
          read: () => providerUserForCleanup(subject),
          waitMilliseconds: 5_000,
        });
      },
      discoverAttempt: async () => {
        const attempt = await discoverCleanupAttempt({
          attempts: 6,
          expectedEmail: email,
          expectedLoginName: loginName,
          read: () =>
            accountCleanupAttempt(
              adminPrincipal.companyId,
              adminPrincipal.userId,
            ),
          waitMilliseconds: 5_000,
        });
        if (attempt) {
          account = { ...account, id: attempt.id };
          providerSubject = attempt.providerSubject;
        }
        return attempt;
      },
      refreshAttempt: () =>
        discoverCleanupAttempt({
          attempts: 1,
          expectedEmail: email,
          expectedLoginName: loginName,
          read: () =>
            accountCleanupAttempt(
              adminPrincipal.companyId,
              adminPrincipal.userId,
            ),
          waitMilliseconds: 0,
        }),
      requireAttempt: accountCreateRequestStarted,
      responseAccountId,
    });
  } catch {
    cleanupFailed = true;
  }
}
await finalizePreviewSmoke({
  cleanupReference: runSuffix,
  cleanupFailed,
  close: () =>
    Promise.all([
      apiSql.end({ timeout: 2 }),
      reconcilerSql.end({ timeout: 2 }),
    ]),
  journeyError,
  writeSuccess: () => console.log("PREVIEW_ACCOUNT_MANAGEMENT_SMOKE_OK"),
});
