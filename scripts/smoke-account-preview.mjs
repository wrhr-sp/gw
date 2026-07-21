import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import {
  discoverCleanupAccount,
  ensureDatabaseInactive,
  waitForProviderInactive,
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
const runSuffix = `${runId}-${runAttempt}`.replace(/[^A-Za-z0-9-]/gu, "-");
const loginName = `preview-smoke-${runSuffix}`.slice(0, 100);
const email = `${loginName}@werehere.invalid`;
const displayName = `Preview 검증 ${runSuffix}`.slice(0, 100);
const assignmentStartDate = new Date().toISOString().slice(0, 10);
const assignmentReason = "Preview release 실제 계정 흐름 검증";
const initialPassword = `preview-a1!-${randomBytes(18).toString("base64url")}`;
const changedPassword = `changed-a1!-${randomBytes(18).toString("base64url")}`;
let adminToken;
let adminPrincipal;
let account;
let providerSubject;
let providerVerificationSession;
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
  if (
    response.status === 204 ||
    !response.headers.get("content-type")?.includes("application/json")
  )
    return null;
  return response.json();
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

async function accountCleanupState(companyId, userId) {
  return reconcilerSql.begin(async (sql) => {
    await sql`select set_config('app.reconciler_company_id', ${companyId}, true)`;
    const rows = await sql`
      select id, version, status
      from public.users
      where company_id = ${companyId}::uuid
        and id = ${userId}::uuid
    `;
    if (rows.length !== 1 || !Number.isInteger(rows[0]?.version)) {
      throw new Error("Preview account cleanup state read-back failed");
    }
    return rows[0];
  });
}

async function accountCleanupStateByLogin(companyId, cleanupLoginName) {
  return reconcilerSql.begin(async (sql) => {
    await sql`select set_config('app.reconciler_company_id', ${companyId}, true)`;
    const rows = await sql`
      select id, version, status
      from public.users
      where company_id = ${companyId}::uuid
        and lower(btrim(login_name)) = lower(btrim(${cleanupLoginName}))
    `;
    if (rows.length > 1) {
      throw new Error("Preview account cleanup login was ambiguous");
    }
    return rows[0];
  });
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
    const persistedHotelIds = rows.map((row) => row.branch_id).sort();
    if (
      JSON.stringify(persistedHotelIds) !== JSON.stringify(expectedHotelIds) ||
      rows.some(
        (row) =>
          row.start_date !== assignmentStartDate ||
          row.reason !== assignmentReason,
      )
    ) {
      throw new Error("Preview housekeeping assignment persistence mismatch");
    }
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

  const created = await api("/api/admin/users", {
    method: "POST",
    token: adminToken,
    idempotencyKey: `preview-account-create-${runSuffix}`,
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
  const pendingSession = await createSession(providerSubject);
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
  account = activatedDetail?.data?.account;
  if (
    !account?.id ||
    account.status !== "ACTIVE" ||
    account.mustChangePassword !== false
  ) {
    throw new Error("Initial password change PostgreSQL read-back failed");
  }

  const providerSession = await provider("/v2/sessions", {
    method: "POST",
    token: verificationToken,
    body: {
      checks: {
        user: { loginName },
        password: { password: changedPassword },
      },
      lifetime: "300s",
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

  console.log("PREVIEW_ACCOUNT_MANAGEMENT_SMOKE_OK");
} catch (error) {
  journeyError = error;
}

let cleanupFailed = false;
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
  } catch {
    cleanupFailed = true;
  }
}
if (adminToken && adminPrincipal?.companyId) {
  try {
    const cleanupTarget = await discoverCleanupAccount({
      attempts: 6,
      read: () =>
        account?.id
          ? accountCleanupState(adminPrincipal.companyId, account.id)
          : accountCleanupStateByLogin(adminPrincipal.companyId, loginName),
      waitMilliseconds: 5_000,
    });
    if (cleanupTarget) {
      account = { ...account, ...cleanupTarget };
      await ensureDatabaseInactive({
        attempts: 6,
        deactivate: (state) =>
          api(
            `/api/admin/users/${encodeURIComponent(cleanupTarget.id)}/deactivate`,
            {
              method: "POST",
              token: adminToken,
              idempotencyKey: `preview-account-cleanup-${runSuffix}`,
              body: {
                version: state.version,
                reason: "Preview release 실패 검증 계정 정리",
              },
            },
          ),
        read: () =>
          accountCleanupState(adminPrincipal.companyId, cleanupTarget.id),
        waitMilliseconds: 5_000,
      });
      await waitForZeroActiveSessions({
        attempts: 6,
        read: () =>
          activeSessionCount(
            adminPrincipal.sessionId,
            adminPrincipal.companyId,
            cleanupTarget.id,
          ),
        waitMilliseconds: 5_000,
      });
      providerSubject ??= await providerSubjectFor(
        adminPrincipal.companyId,
        cleanupTarget.id,
      );
      await waitForProviderInactive({
        attempts: 24,
        expectedOrganizationId: organizationId,
        expectedSubject: providerSubject,
        read: () =>
          provider(`/v2/users/${encodeURIComponent(providerSubject)}`),
        waitMilliseconds: 5_000,
      });
    }
  } catch {
    cleanupFailed = true;
  }
}
try {
  await Promise.all([
    apiSql.end({ timeout: 2 }),
    reconcilerSql.end({ timeout: 2 }),
  ]);
} catch {
  cleanupFailed = true;
}
if (cleanupFailed) {
  throw new Error("PREVIEW_ACCOUNT_CLEANUP_FAILED");
}
if (journeyError) throw journeyError;
