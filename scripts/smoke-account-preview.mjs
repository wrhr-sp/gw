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
  waitForZeroActiveSessions,
} from "./lib/preview-account-smoke-cleanup.mjs";
import {
  runHostedMutation,
  runHostedMutationWithReload,
} from "./lib/preview-relationship-smoke-contract.mjs";

const requireFromDb = createRequire(
  new URL("../packages/db/package.json", import.meta.url),
);
const requireFromWeb = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const postgres = requireFromDb("postgres");
const axeModule = requireFromWeb("@axe-core/playwright");
const AxeBuilder = axeModule.default ?? axeModule;

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

let journeyError;
let journeyFailureCode = "UNCLASSIFIED";

const accountCreateSagaStatuses = new Set([
  "RESERVED_NOT_DISPATCHED",
  "DISPATCHED",
  "PROVIDER_CONFIRMED",
  "COMPLETED",
  "RECOVERY_REQUIRED",
  "COMPENSATION_REQUIRED",
  "COMPENSATED",
  "OPERATOR_REQUIRED",
  "DEAD_LETTER",
]);

function tokenHash(token) {
  return createHash("sha256").update(token, "utf8").digest();
}

async function createSession(providerSubjectValue, failurePrefix) {
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
  const knownStatuses = new Set([
    "IDENTITY_NOT_PROVISIONED",
    "PRINCIPAL_INACTIVE",
    "RUNTIME_DENIED",
  ]);
  const invalidResponse = () => {
    const error = new Error("Preview smoke session response was invalid");
    error.previewFailureCode = `${failurePrefix}_INVALID_RESPONSE`;
    throw error;
  };
  if (rows.length !== 1) invalidResponse();
  const result = rows[0];
  if (result?.result_status !== "CREATED") {
    const denialHasNoPrincipal = [
      result?.company_id,
      result?.identity_id,
      result?.session_id,
      result?.user_id,
      result?.user_type,
      result?.display_name,
      result?.must_change_password,
    ].every((value) => value === null);
    if (!knownStatuses.has(result?.result_status) || !denialHasNoPrincipal) {
      invalidResponse();
    }
    const error = new Error("Preview smoke session could not be created");
    error.previewFailureCode = `${failurePrefix}_${result.result_status}`;
    throw error;
  }
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
  if (
    !uuidPattern.test(result.company_id ?? "") ||
    !uuidPattern.test(result.identity_id ?? "") ||
    !uuidPattern.test(result.session_id ?? "") ||
    !uuidPattern.test(result.user_id ?? "") ||
    typeof result.user_type !== "string" ||
    result.user_type.length === 0 ||
    typeof result.display_name !== "string" ||
    result.display_name.length === 0 ||
    typeof result.must_change_password !== "boolean"
  ) {
    invalidResponse();
  }
  return {
    token,
    principal: {
      companyId: result.company_id,
      sessionId: result.session_id,
      userId: result.user_id,
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
    const error = new Error(
      `Account Preview smoke ${path} failed with ${response.status} (${code})`,
    );
    const accountCreateCodes = new Set([
      "ACCOUNT_DUPLICATE",
      "AUTH_REQUIRED",
      "EXTERNAL_AUTH_NOT_CONFIGURED",
      "EXTERNAL_AUTH_UNAVAILABLE",
      "FORBIDDEN",
      "IDEMPOTENCY_CONFLICT",
      "INTERNAL_ERROR",
      "SCHEMA_NOT_READY",
      "VALIDATION_ERROR",
    ]);
    if (
      path === "/api/admin/users" &&
      method === "POST" &&
      journeyFailureCode === "ACCOUNT_CREATE" &&
      accountCreateCodes.has(code)
    ) {
      error.previewFailureCode = `ACCOUNT_CREATE_${code}`;
    }
    if (journeyFailureCode === "INSPECTION_CHECKLIST_V2_INITIAL_READ") {
      const checklistReadCodes = new Set([
        "AUTHENTICATION_REQUIRED",
        "DB_NOT_CONFIGURED",
        "FORBIDDEN",
        "INTERNAL_ERROR",
        "RESOURCE_NOT_FOUND",
        "SCHEMA_NOT_READY",
      ]);
      const safeCode = checklistReadCodes.has(code) ? code : "OTHER";
      error.previewFailureCode =
        `INSPECTION_CHECKLIST_V2_INITIAL_READ_${safeCode}`;
    }
    throw error;
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
      select id, login_name, version, status, must_change_password
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
    await page.waitForURL(
      (candidate) =>
        candidate.origin === new URL(baseUrl).origin &&
        candidate.pathname === "/login" &&
        /^[A-Za-z0-9_-]{1,200}$/u.test(
          candidate.searchParams.get("authRequest") ?? "",
        ) &&
        /^[A-Za-z0-9_-]{43}$/u.test(candidate.searchParams.get("csrf") ?? ""),
      { timeout: 60_000 },
    );
    const loginInput = page.locator("#login-name");
    await loginInput.evaluate((element) => element.removeAttribute("pattern"));
    await loginInput.fill(loginId);
    await page.locator("#login-password").fill(password);
    await page.getByRole("button", { name: "로그인" }).click();

    if (!shouldAuthenticate) {
      await page.waitForURL(
        (candidate) =>
          candidate.origin === new URL(baseUrl).origin &&
          candidate.pathname === "/login" &&
          candidate.searchParams.get("error") === "invalid-credentials",
        { timeout: 60_000 },
      );
      const rejectedCookies = await context.cookies(baseUrl);
      if (rejectedCookies.some((cookie) => cookie.name === cookieName)) {
        throw new Error("Rejected legacy login alias issued a hotel session");
      }
      return;
    }

    await page.waitForURL(
      (candidate) =>
        candidate.origin === new URL(baseUrl).origin &&
        !candidate.pathname.startsWith("/api/auth") &&
        candidate.pathname !== "/login",
      { timeout: 60_000 },
    );
    const sessionResponse = await context.request.get(
      `${baseUrl}/api/auth/session`,
      {
        headers: { accept: "application/json" },
      },
    );
    if (sessionResponse.status() !== 200) {
      throw new Error(
        "Hosted canonical login did not issue a readable hotel session",
      );
    }
    const sessionBody = await sessionResponse.json();
    if (
      sessionBody?.data?.authenticated !== true ||
      sessionBody.data?.principal?.userId !== expectedUserId
    ) {
      throw new Error(
        "Hosted canonical login resolved an unexpected internal user",
      );
    }
  } finally {
    await browser.close();
  }
}

async function verifyHostedRelationshipManagement({
  accountId,
  displayName: expectedDisplayName,
  email: expectedEmail,
  hotelId,
  loginName: expectedLoginName,
  token,
}) {
  const setMutationFailureCode = (operation, failure) => {
    if (failure.kind === "click") {
      journeyFailureCode = `${operation}_MUTATION_CLICK`;
      return;
    }
    if (failure.kind === "response") {
      journeyFailureCode = `${operation}_MUTATION_RESPONSE`;
      return;
    }
    const statusBucket =
      failure.status === 401 || failure.status === 403
        ? "AUTH"
        : failure.status === 409
          ? "CONFLICT"
          : failure.status === 400 || failure.status === 422
            ? "VALIDATION"
            : Number.isInteger(failure.status) && failure.status >= 500
              ? "SERVER"
              : "OTHER";
    journeyFailureCode = `${operation}_MUTATION_STATUS_${statusBucket}`;
  };
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: cookieName,
        value: token,
        url: baseUrl,
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);
    const relationshipLoadCounterKey =
      "__werehere_preview_relationship_load_count";
    await context.addInitScript((counterKey) => {
      if (window.top !== window) return;
      const current = Number.parseInt(
        window.sessionStorage.getItem(counterKey) ?? "0",
        10,
      );
      window.sessionStorage.setItem(counterKey, String(current + 1));
    }, relationshipLoadCounterKey);
    const page = await context.newPage();
    journeyFailureCode = "RELATIONSHIP_UI_RENDER_NAVIGATE";
    await page.goto(`${baseUrl}/hotels/${encodeURIComponent(hotelId)}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    journeyFailureCode = "RELATIONSHIP_UI_RENDER_HEADING";
    const relationshipHeading = page.getByRole("heading", {
      name: "관계 및 운영 준비",
    });
    await relationshipHeading.waitFor({ state: "visible", timeout: 60_000 });
    let expectedRelationshipLoadCount = await page.evaluate(
      (counterKey) =>
        Number.parseInt(window.sessionStorage.getItem(counterKey) ?? "0", 10),
      relationshipLoadCounterKey,
    );
    const waitForRelationshipReload = async () => {
      expectedRelationshipLoadCount += 1;
      await page.waitForFunction(
        ({ counterKey, expected }) =>
          Number.parseInt(
            window.sessionStorage.getItem(counterKey) ?? "0",
            10,
          ) >= expected,
        {
          counterKey: relationshipLoadCounterKey,
          expected: expectedRelationshipLoadCount,
        },
        { timeout: 60_000 },
      );
    };
    const relationshipPanel = page.locator(
      'section[aria-labelledby="hotel-relationships-title"]',
    );
    journeyFailureCode = "RELATIONSHIP_UI_RENDER_ASSIGNMENT";
    const targetAssignment = relationshipPanel
      .getByRole("listitem")
      .filter({ hasText: expectedDisplayName });
    await targetAssignment.waitFor({ state: "visible", timeout: 60_000 });
    if ((await targetAssignment.count()) !== 1) {
      throw new Error(
        "Hosted relationship UI did not render the expected assignment",
      );
    }
    journeyFailureCode = "RELATIONSHIP_UI_RENDER_NORMAL_END_GUARD";
    if (
      (await relationshipPanel
        .getByRole("button", { name: "정상 종료" })
        .count()) !== 0
    ) {
      throw new Error(
        "Hosted relationship UI exposed unsafe normal termination",
      );
    }

    journeyFailureCode = "RELATIONSHIP_UI_END_DIALOG";
    await targetAssignment.getByRole("button", { name: "긴급 종료" }).click();
    const endDialog = page.getByRole("alertdialog", {
      name: "관계를 긴급 종료하시겠습니까?",
    });
    await endDialog
      .getByLabel("긴급 종료 사유")
      .fill("Preview hosted 관계 종료 검증");
    journeyFailureCode = "RELATIONSHIP_UI_END_MUTATION";
    await runHostedMutationWithReload({
      acceptedStatuses: [200],
      beforeReload: () => {
        journeyFailureCode = "RELATIONSHIP_UI_END_RELOAD";
      },
      click: () =>
        endDialog.getByRole("button", { name: "긴급 종료 확인" }).click(),
      label: "Hosted relationship emergency end",
      onFailure: (failure) =>
        setMutationFailureCode("RELATIONSHIP_UI_END", failure),
      waitForReload: waitForRelationshipReload,
      waitForResponse: () =>
        page.waitForResponse(
          (response) =>
            response.request().method() === "POST" &&
            response.url().includes(`/api/hotels/${hotelId}/assignments/`) &&
            response.url().endsWith("/end"),
          { timeout: 60_000 },
        ),
    });

    journeyFailureCode = "RELATIONSHIP_UI_ASSIGN";
    await page.getByRole("button", { name: "배정 추가" }).click();
    const assignmentDialog = page.getByRole("dialog", { name: "배정 추가" });
    await assignmentDialog.getByLabel("관계유형").selectOption("HOUSEKEEPING");
    await assignmentDialog
      .getByLabel("시작일", { exact: true })
      .fill(assignmentStartDate);
    await assignmentDialog
      .getByLabel("후보 이름 검색")
      .fill(expectedDisplayName);
    const candidate = assignmentDialog.getByLabel("배정 후보");
    await candidate
      .getByRole("option", { name: expectedDisplayName })
      .waitFor({ state: "attached", timeout: 60_000 });
    const visibleText = await assignmentDialog.innerText();
    if (
      visibleText.includes(expectedEmail) ||
      visibleText.includes(expectedLoginName) ||
      visibleText.includes(accountId)
    ) {
      throw new Error(
        "Hosted relationship candidate UI exposed private identity data",
      );
    }
    await candidate.selectOption({ label: expectedDisplayName });
    await assignmentDialog.getByLabel("배정 사유").fill(assignmentReason);
    journeyFailureCode = "RELATIONSHIP_UI_ASSIGN_MUTATION";
    await runHostedMutationWithReload({
      acceptedStatuses: [200, 201],
      beforeReload: () => {
        journeyFailureCode = "RELATIONSHIP_UI_ASSIGN_RELOAD";
      },
      click: () =>
        assignmentDialog.getByRole("button", { name: "배정 저장" }).click(),
      label: "Hosted relationship assignment",
      onFailure: (failure) =>
        setMutationFailureCode("RELATIONSHIP_UI_ASSIGN", failure),
      waitForReload: waitForRelationshipReload,
      waitForResponse: () =>
        page.waitForResponse(
          (response) =>
            response.request().method() === "POST" &&
            response.url().endsWith(`/api/hotels/${hotelId}/assignments`),
          { timeout: 60_000 },
        ),
    });
    await relationshipPanel
      .getByRole("listitem")
      .filter({ hasText: expectedDisplayName })
      .waitFor({ state: "visible", timeout: 60_000 });

    journeyFailureCode = "RELATIONSHIP_UI_READINESS";
    await runHostedMutation({
      acceptedStatuses: [409],
      click: () =>
        relationshipPanel
          .getByRole("button", { name: "준비상태 확인" })
          .click(),
      label: "Hosted activation readiness did not fail closed",
      waitForResponse: () =>
        page.waitForResponse(
          (response) =>
            response.request().method() === "POST" &&
            response.url().endsWith(`/api/hotels/${hotelId}/activate`),
          { timeout: 60_000 },
        ),
    });
    await relationshipPanel
      .getByRole("alert")
      .filter({ hasText: "준비항목" })
      .waitFor({ state: "visible", timeout: 60_000 });
  } finally {
    await browser.close();
  }
}

async function ensureHostedChecklistScope(hotelId, token, principal) {
  const path = `/api/hotels/${encodeURIComponent(hotelId)}/assignments`;
  const hasActiveStaffAssignment = (value) =>
    (value?.data?.assignments ?? []).some(
      (assignment) =>
        assignment?.userId === principal.userId &&
        assignment?.relationshipType === "STAFF" &&
        assignment?.terminatedAt === null &&
        assignment?.startDate <= assignmentStartDate &&
        (assignment?.endDate === null ||
          assignment.endDate >= assignmentStartDate),
    );
  let assignments = await api(path, { token });
  if (hasActiveStaffAssignment(assignments)) return;

  const detail = await api(`/api/hotels/${encodeURIComponent(hotelId)}`, {
    token,
  });
  const hotelVersion = detail?.data?.hotel?.version;
  if (!Number.isInteger(hotelVersion) || hotelVersion < 1) {
    throw new Error("Preview checklist scope requires a canonical hotel version");
  }
  await api(path, {
    method: "POST",
    token,
    idempotencyKey: `preview-checklist-admin-scope-${hotelId}`,
    expectedStatuses: [200, 201],
    body: {
      userId: principal.userId,
      relationshipType: "STAFF",
      assignmentType: "PRIMARY",
      startDate: assignmentStartDate,
      reason: "Preview 점검항목 실제 권한 검증 배정",
      hotelVersion,
    },
  });
  assignments = await api(path, { token });
  if (!hasActiveStaffAssignment(assignments)) {
    throw new Error("Preview checklist staff assignment read-back failed");
  }
}

async function verifyHostedChecklistV2(hotelId, token) {
  const path = `/api/hotels/${encodeURIComponent(hotelId)}/inspection-checklist/v2`;
  journeyFailureCode = "INSPECTION_CHECKLIST_V2_INITIAL_READ";
  const initial = await api(path, { token });
  const current = initial?.data?.checklist ?? null;
  const existingItems = Array.isArray(current?.items) ? current.items : [];
  const items = existingItems.map((item) => ({
    itemId: item.itemId,
    targetType: item.targetType,
    source: item.source,
    ...(item.targetType === "ROOM"
      ? {
          roomTypeId: item.roomTypeId,
          excludedRoomTypeIds: item.excludedRoomTypeIds,
        }
      : {
          facilityTypeId: item.facilityTypeId,
          excludedFacilityTypeIds: item.excludedFacilityTypeIds,
        }),
    name: item.name,
    description: item.description,
    isRequired: item.isRequired,
    displayOrder: item.displayOrder,
    defaultSeverity: item.defaultSeverity,
  }));
  if (!items.some((item) => item.targetType === "ROOM"))
    items.push({
      itemId: null,
      targetType: "ROOM",
      source: "HOTEL_COMMON",
      roomTypeId: null,
      excludedRoomTypeIds: [],
      name: "Preview 객실 공통 점검",
      description: null,
      isRequired: true,
      displayOrder: 10,
      defaultSeverity: "OBSERVATION",
    });
  if (!items.some((item) => item.targetType === "FACILITY"))
    items.push({
      itemId: null,
      targetType: "FACILITY",
      source: "HOTEL_COMMON",
      facilityTypeId: null,
      excludedFacilityTypeIds: [],
      name: "Preview 시설물 공통 점검",
      description: null,
      isRequired: true,
      displayOrder: 20,
      defaultSeverity: "OBSERVATION",
    });
  const reason = `Preview v2 저장 검증 ${runSuffix}`;
  journeyFailureCode = "INSPECTION_CHECKLIST_V2_SAVE";
  const saved = await api(path, {
    method: "PUT",
    token,
    idempotencyKey: `preview-checklist-v2-${runSuffix}-${hotelId}`,
    body: { version: current?.version ?? 0, reason, items },
  });
  const receipt = saved?.data?.checklist;
  journeyFailureCode = "INSPECTION_CHECKLIST_V2_CANONICAL_READ";
  const read = (await api(path, { token }))?.data?.checklist;
  const material = (checklist) =>
    JSON.stringify({
      id: checklist?.id,
      version: checklist?.version,
      reason: checklist?.reason,
      items: checklist?.items,
    });
  journeyFailureCode = "INSPECTION_CHECKLIST_V2_CANONICAL_COMPARE";
  const ids = receipt?.items?.map((item) => item.itemId) ?? [];
  if (
    !receipt ||
    !read ||
    receipt.reason !== reason ||
    ids.length !== items.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => typeof id !== "string" || id.length < 32) ||
    material(receipt) !== material(read)
  ) {
    throw new Error("Preview checklist v2 canonical read-back failed");
  }
  journeyFailureCode = "INSPECTION_CHECKLIST_V2_LEGACY_READ";
  const legacy = await api(
    `/api/hotels/${encodeURIComponent(hotelId)}/inspection-checklist`,
    { token },
  );
  if (
    legacy?.data?.checklist?.items?.some(
      (item) => "targetType" in item || "facilityTypeId" in item,
    )
  ) {
    throw new Error("Preview checklist v1 projection leaked FACILITY fields");
  }
  return read;
}

async function verifyHostedChecklistUi(hotelId, token, canonicalChecklist) {
  const browser = await chromium.launch({ headless: true });
  const path = `/api/hotels/${encodeURIComponent(hotelId)}/inspection-checklist/v2`;
  const endpoint = `${baseUrl}${path}`;
  const facilityItem = canonicalChecklist?.items?.find(
    (item) => item.targetType === "FACILITY",
  );
  if (!facilityItem) {
    throw new Error("Hosted checklist UI requires a canonical FACILITY item");
  }
  const itemName = "Preview UI 시설물 점검";
  const reason = `Preview UI 응답 유실 재시도 ${runSuffix}`;
  const assertAccessible = async (page, viewport) => {
    const accessibility = await new AxeBuilder({ page }).analyze();
    const blocking = accessibility.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    );
    if (blocking.length > 0) {
      throw new Error(
        `Hosted checklist UI ${viewport} accessibility failed: ${blocking
          .map((violation) => violation.id)
          .join(",")}`,
      );
    }
  };
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.addCookies([
      {
        name: cookieName,
        value: token,
        url: baseUrl,
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);
    const page = await context.newPage();
    const idempotencyKeys = [];
    page.on("request", (request) => {
      if (request.method() === "PUT" && request.url() === endpoint) {
        idempotencyKeys.push(request.headers()["idempotency-key"] ?? "");
      }
    });
    let responseDroppedAfterCommit = false;
    await page.route(endpoint, async (route) => {
      if (
        route.request().method() === "PUT" &&
        !responseDroppedAfterCommit
      ) {
        const committed = await route.fetch();
        if (!committed.ok()) {
          throw new Error(
            `Hosted checklist UI commit failed before response loss: ${committed.status()}`,
          );
        }
        responseDroppedAfterCommit = true;
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    journeyFailureCode = "INSPECTION_CHECKLIST_V2_UI_NAVIGATE";
    await page.goto(
      `${baseUrl}/hotels/${encodeURIComponent(hotelId)}/inspections/settings`,
      { waitUntil: "domcontentloaded", timeout: 60_000 },
    );
    await page
      .getByRole("heading", { name: "점검 설정" })
      .waitFor({ state: "visible", timeout: 60_000 });
    await assertAccessible(page, "mobile");
    const facilityInput = page
      .locator(`[data-checklist-item-id="${facilityItem.itemId}"]`)
      .getByRole("textbox", { name: /^항목 이름 /u });
    await facilityInput.waitFor({ state: "visible", timeout: 60_000 });
    await facilityInput.fill(itemName);
    await page.getByLabel("변경사유").fill(reason);

    journeyFailureCode = "INSPECTION_CHECKLIST_V2_UI_COMMITTED_RESPONSE_LOSS";
    await page.getByRole("button", { name: "체크리스트 저장" }).click();
    await page.waitForFunction(() => document.querySelector('[data-checklist-status]')?.textContent?.includes("네트워크 응답을 확인하지 못했습니다"), undefined, { timeout: 60_000 });
    if (!responseDroppedAfterCommit) {
      throw new Error("Hosted checklist UI did not simulate committed response loss");
    }

    journeyFailureCode = "INSPECTION_CHECKLIST_V2_UI_REPLAY";
    const replayResponse = page.waitForResponse(
      (response) => response.request().method() === "PUT" && response.url() === endpoint,
      { timeout: 60_000 },
    );
    await page.getByRole("button", { name: "체크리스트 저장" }).click();
    const replay = await replayResponse;
    if (!replay.ok()) {
      throw new Error(`Hosted checklist UI replay failed: ${replay.status()}`);
    }
    await page
      .getByText("체크리스트를 저장하고 다시 확인했습니다.")
      .waitFor({ state: "visible", timeout: 60_000 });
    if (
      idempotencyKeys.length < 2 ||
      !idempotencyKeys[0] ||
      idempotencyKeys[0] !== idempotencyKeys[1]
    ) {
      throw new Error("Hosted checklist UI changed the idempotency key on same-body replay");
    }

    journeyFailureCode = "INSPECTION_CHECKLIST_V2_UI_DESKTOP_RELOAD";
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    journeyFailureCode = "INSPECTION_CHECKLIST_V2_UI_DESKTOP_VALUE";
    const canonicalAfterReplay = (await api(path, { token }))?.data?.checklist;
    const savedFacilityItem = canonicalAfterReplay?.items?.find(
      (item) => item.itemId === facilityItem.itemId,
    );
    if (savedFacilityItem?.name !== itemName) {
      throw new Error("Hosted checklist UI canonical item read-back failed");
    }
    const desktopFacilityInput = page
      .locator(`[data-checklist-item-id="${facilityItem.itemId}"]`)
      .getByRole("textbox", { name: /^항목 이름 /u });
    await desktopFacilityInput.waitFor({ state: "visible", timeout: 60_000 });
    if ((await desktopFacilityInput.inputValue()) !== itemName) {
      throw new Error("Hosted checklist UI rendered item read-back failed");
    }
    journeyFailureCode = "INSPECTION_CHECKLIST_V2_UI_DESKTOP_AXE";
    await assertAccessible(page, "desktop");

    journeyFailureCode = "PROCESS_WORKS_UI";
    const processName = "Preview Works 검토";
    const stageName = "Preview 확인";
    const definitionsPath = `/api/admin/process-definitions?hotelId=${encodeURIComponent(hotelId)}`;
    const currentDefinitions =
      (await api(definitionsPath, { token }))?.data?.definitions ?? [];
    const currentDefinition = currentDefinitions.find(
      (definition) => definition.name === processName,
    );
    if (currentDefinition) {
      await page
        .getByRole("button", {
          name: `${processName} v${currentDefinition.version} 수정`,
        })
        .click();
    } else {
      await page.getByRole("button", { name: "새 프로세스" }).click();
      await page.getByLabel("프로세스 이름").fill(processName);
    }
    const processFlow = page.getByRole("region", { name: "업무 처리 흐름" });
    await processFlow.waitFor({ state: "visible", timeout: 60_000 });
    if ((await processFlow.getByText(stageName, { exact: true }).count()) === 0) {
      await processFlow.getByRole("button", { name: "단계 추가" }).click();
      const stateNames = page.getByLabel("상태 이름");
      const stateCount = await stateNames.count();
      if (stateCount < 3) {
        throw new Error("Hosted process UI did not add a business status");
      }
      await stateNames.nth(stateCount - 2).fill(stageName);
    }
    if ((await page.getByText("단계 키", { exact: true }).count()) !== 0) {
      throw new Error("Hosted process UI exposed internal stage keys");
    }
    await page
      .getByRole("button", {
        name: currentDefinition ? "프로세스 수정 저장" : "프로세스 생성",
      })
      .click();
    await page
      .getByText(/^프로세스 v\d+을 저장하고 다시 확인했습니다\.$/u)
      .waitFor({ state: "visible", timeout: 60_000 });
    const canonicalDefinitions =
      (await api(definitionsPath, { token }))?.data?.definitions ?? [];
    const canonicalDefinition = canonicalDefinitions.find(
      (definition) => definition.name === processName,
    );
    const canonicalStage = canonicalDefinition?.stages?.find(
      (stage) => stage.name === stageName && stage.isFinal === false,
    );
    if (
      !canonicalDefinition ||
      !canonicalStage ||
      !canonicalDefinition.transitions?.some(
        (transition) => transition.fromStageKey === canonicalStage.key,
      )
    ) {
      throw new Error("Hosted process UI canonical read-back failed");
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await assertAccessible(page, "process-mobile");

  } finally {
    await browser.close();
  }
}

try {
  journeyFailureCode = "ADMIN_SESSION_CREATE";
  const adminSession = await createSession(bootstrapSubject, "ADMIN_SESSION");
  adminToken = adminSession.token;
  adminPrincipal = adminSession.principal;

  journeyFailureCode = "ELIGIBLE_HOTELS_READ";
  let eligible = await api("/api/admin/users/eligible-hotels", {
    token: adminToken,
  });
  let eligibleHotels = eligible?.data?.hotels ?? [];
  for (let slot = eligibleHotels.length; slot < 2; slot += 1) {
    const hotelNumber = slot + 1;
    journeyFailureCode = "HOTEL_BOOTSTRAP_CREATE";
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
    journeyFailureCode = "ELIGIBLE_HOTELS_READ";
    eligible = await api("/api/admin/users/eligible-hotels", {
      token: adminToken,
    });
    eligibleHotels = eligible?.data?.hotels ?? [];
  }
  const hotelIds = eligibleHotels
    .slice(0, 2)
    .map((hotel) => hotel.id)
    .sort();
  journeyFailureCode = "HOTEL_BOOTSTRAP_VERIFY";
  if (hotelIds.length !== 2 || new Set(hotelIds).size !== 2) {
    throw new Error("Preview smoke requires two distinct eligible hotels");
  }
  journeyFailureCode = "INSPECTION_CHECKLIST_SCOPE";
  await ensureHostedChecklistScope(hotelIds[0], adminToken, adminPrincipal);
  journeyFailureCode = "INSPECTION_CHECKLIST_V2";
  const canonicalChecklist = await verifyHostedChecklistV2(
    hotelIds[0],
    adminToken,
  );
  journeyFailureCode = "INSPECTION_CHECKLIST_V2_UI";
  await verifyHostedChecklistUi(hotelIds[0], adminToken, canonicalChecklist);

  journeyFailureCode = "ACCOUNT_CREATE";
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
  journeyFailureCode = "ACCOUNT_CREATE_ATTEMPT_READBACK";
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
  if (!createAttempt) {
    throw new Error(
      "Created Preview account durable attempt was not observable",
    );
  }
  journeyFailureCode = "ACCOUNT_CREATE_IDENTITY_MATCH";
  account = assertCreateResponseMatchesAttempt(account, createAttempt);
  journeyFailureCode = "ACCOUNT_CREATE_RESPONSE_SCHEMA";
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
    !hotelIds.includes(account.hotelId) ||
    JSON.stringify(createdHotelIds) !== JSON.stringify(hotelIds)
  ) {
    throw new Error("Created Preview account response was invalid");
  }

  journeyFailureCode = "ACCOUNT_DETAIL_READBACK";
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
    !hotelIds.includes(detailAccount.hotelId) ||
    JSON.stringify(detailHotelIds) !== JSON.stringify(hotelIds)
  ) {
    throw new Error("Created Preview account PostgreSQL GET read-back failed");
  }

  journeyFailureCode = "HOUSEKEEPING_ASSIGNMENTS";
  await assertHousekeepingAssignments(
    adminSession.principal.companyId,
    account.id,
    hotelIds,
  );

  journeyFailureCode = "PROVIDER_IDENTITY_READBACK";
  providerSubject = await providerSubjectFor(
    adminSession.principal.companyId,
    account.id,
  );
  if (providerSubject !== createAttempt.providerSubject) {
    throw new Error(
      "Created account provider subject did not match durable target",
    );
  }
  journeyFailureCode = "PENDING_SESSION_CREATE";
  pendingSession = await createSession(providerSubject, "PENDING_SESSION");
  journeyFailureCode = "INITIAL_PASSWORD";
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
  const activatedState = await accountCleanupState(
    adminSession.principal.companyId,
    account.id,
    loginName,
  );
  if (
    activatedAccount?.id !== createAttempt.id ||
    activatedAccount.status !== "ACTIVE" ||
    activatedState.id !== createAttempt.id ||
    activatedState.status !== "ACTIVE" ||
    activatedState.must_change_password !== false
  ) {
    throw new Error("Initial password change PostgreSQL read-back failed");
  }
  account = activatedAccount;

  journeyFailureCode = "CUSTOM_LOGIN_CANONICAL";
  await verifyHostedCustomLogin({
    expectedUserId: account.id,
    loginId: loginName,
    password: changedPassword,
    shouldAuthenticate: true,
  });
  const legacyAlias = `${loginName.slice(0, -1)}-${loginName.slice(-1)}`;
  journeyFailureCode = "CUSTOM_LOGIN_LEGACY_REJECT";
  await verifyHostedCustomLogin({
    expectedUserId: account.id,
    loginId: legacyAlias,
    password: changedPassword,
    shouldAuthenticate: false,
  });

  journeyFailureCode = "RELATIONSHIP_MANAGEMENT_UI";
  await verifyHostedRelationshipManagement({
    accountId: account.id,
    displayName,
    email,
    hotelId: hotelIds[0],
    loginName,
    token: adminToken,
  });
  journeyFailureCode = "HOUSEKEEPING_ASSIGNMENTS_AFTER_RELATIONSHIP_UI";
  await assertHousekeepingAssignments(
    adminSession.principal.companyId,
    account.id,
    hotelIds,
  );

  journeyFailureCode = "ACCOUNT_DEACTIVATE";
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

  journeyFailureCode = "ACCOUNT_INACTIVE_READBACK";
  const inactiveDetail = await api(
    `/api/admin/users/${encodeURIComponent(account.id)}`,
    {
      token: adminToken,
    },
  );
  if (inactiveDetail?.data?.account?.status !== "INACTIVE") {
    throw new Error("Inactive Preview account PostgreSQL read-back failed");
  }
  journeyFailureCode = "PROVIDER_INACTIVE";
  await waitForProviderInactive({
    attempts: 24,
    expectedOrganizationId: organizationId,
    expectedSubject: providerSubject,
    read: () => provider(`/v2/users/${encodeURIComponent(providerSubject)}`),
    waitMilliseconds: 5_000,
  });
  journeyFailureCode = "SESSION_REVOCATION";
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
  if (
    error &&
    typeof error === "object" &&
    typeof error.previewFailureCode === "string"
  ) {
    journeyFailureCode = error.previewFailureCode;
  }
}

let cleanupFailed = false;
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
          if (
            journeyFailureCode === "ACCOUNT_CREATE_INTERNAL_ERROR" &&
            accountCreateSagaStatuses.has(attempt.attemptStatus)
          ) {
            journeyFailureCode = `ACCOUNT_CREATE_INTERNAL_ERROR_SAGA_${attempt.attemptStatus}`;
          }
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
try {
  await finalizePreviewSmoke({
    cleanupReference: runSuffix,
    cleanupFailed,
    close: () =>
      Promise.all([
        apiSql.end({ timeout: 2 }),
        reconcilerSql.end({ timeout: 2 }),
      ]),
    journeyError,
    journeyFailureCode,
    writeSuccess: () =>
      console.log(
        "PREVIEW_PROCESS_WORKS_UI_SMOKE_OK\nPREVIEW_ACCOUNT_MANAGEMENT_SMOKE_OK",
      ),
  });
} catch (error) {
  const message = error instanceof Error ? error.message : "";
  if (
    /^PREVIEW_ACCOUNT_JOURNEY_FAILED_[A-Z0-9_]+$/u.test(message) ||
    /^PREVIEW_ACCOUNT_CLEANUP_FAILED \[ref=[A-Za-z0-9]+\]$/u.test(message)
  ) {
    throw new Error(message);
  }
  throw new Error("PREVIEW_ACCOUNT_SMOKE_FAILED");
}
