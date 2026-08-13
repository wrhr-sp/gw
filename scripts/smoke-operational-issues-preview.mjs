import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";

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
const apiUrlFile = process.env.API_RUNTIME_DATABASE_URL_FILE?.trim();
const ownerDatabaseUrl = process.env.DATABASE_URL_PREVIEW?.trim();
if (
  !baseUrl?.startsWith("https://") ||
  !bootstrapSubject ||
  !apiUrlFile ||
  !ownerDatabaseUrl
)
  throw new Error("PREVIEW_OPERATIONAL_ISSUES_CONFIGURATION_INVALID");

const databaseUrl = (await readFile(apiUrlFile, "utf8")).trim();
const sql = postgres(databaseUrl, { max: 1, prepare: false });
const ownerSql = postgres(ownerDatabaseUrl, { max: 1, prepare: false });
const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token, "utf8").digest();
const sessionId = randomUUID();
const grantIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const permissionCodes = [
  "HOTEL_ISSUE_READ",
  "HOTEL_ISSUE_CREATE",
  "HOTEL_ISSUE_WORK",
  "HOTEL_ISSUE_MANAGE",
];
const apiUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
let browser;
let sessionCreated = false;
let grantsCreated = false;
let createdIssue = null;
let hotelId = null;
let failureStage = "SESSION";

async function request(path, options = {}) {
  const headers = {
    accept: "application/json",
    cookie: `__Host-hotel_session=${token}`,
  };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.idempotencyKey)
    headers["idempotency-key"] = options.idempotencyKey;
  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  return {
    payload: await response.json().catch(() => undefined),
    response,
  };
}

async function api(path, options = {}) {
  const { payload, response } = await request(path, options);
  if (!response.ok || payload?.ok !== true || payload?.error !== null) {
    const safeErrorCode = /^[A-Z_]+$/u.test(payload?.error?.code)
      ? payload.error.code
      : null;
    throw new Error(
      `${options.failureCode ?? "PREVIEW_OPERATIONAL_ISSUES_API_INVALID"}${safeErrorCode ? `_${safeErrorCode}` : ""}`,
    );
  }
  return payload.data;
}

async function command(path, body, failureCode) {
  const data = await api(path, {
    body,
    failureCode,
    idempotencyKey: randomUUID(),
    method: "POST",
  });
  const issue = data?.issue;
  if (!issue?.id || typeof issue.version !== "number")
    throw new Error(`${failureCode}_RESPONSE_INVALID`);
  createdIssue = issue;
  return issue;
}

async function requireVisible(locator, failureCode, timeout = 30_000) {
  try {
    await locator.waitFor({ state: "visible", timeout });
  } catch {
    throw new Error(failureCode);
  }
}

try {
  failureStage = "SESSION";
  const sessions = await sql`
    select * from public.auth_create_session_v2(
      ${sessionId}::uuid, ${tokenHash}, ${bootstrapSubject},
      28800, 86400, statement_timestamp(), ${randomUUID()}::uuid
    )
  `;
  const principal = sessions[0];
  if (
    sessions.length !== 1 ||
    principal?.result_status !== "CREATED" ||
    !principal?.company_id ||
    !principal?.user_id ||
    principal?.user_type !== "INTERNAL_STAFF"
  )
    throw new Error("PREVIEW_OPERATIONAL_ISSUES_SESSION_FAILED");
  sessionCreated = true;

  failureStage = "HOTEL_SCOPE";
  const [scope] = await ownerSql`
    select assignment.branch_id
      from public.hotel_staff_assignments assignment
      join public.branches branch
        on branch.company_id=assignment.company_id
       and branch.id=assignment.branch_id
      join public.hotel_profiles hotel
        on hotel.company_id=assignment.company_id
       and hotel.branch_id=assignment.branch_id
     where assignment.company_id=${principal.company_id}::uuid
       and assignment.user_id=${principal.user_id}::uuid
       and assignment.terminated_at is null
       and assignment.start_date<=statement_timestamp()::date
       and (assignment.end_date is null or assignment.end_date>=statement_timestamp()::date)
       and branch.branch_type='HOTEL'
       and branch.status='ACTIVE'
       and hotel.hotel_status='ACTIVE'
       and branch.id::text ~* ${apiUuidPattern.source}
     order by assignment.created_at,assignment.id
     limit 1
  `;
  hotelId = scope?.branch_id;
  if (!hotelId || !apiUuidPattern.test(String(hotelId)))
    throw new Error("PREVIEW_OPERATIONAL_ISSUES_HOTEL_UNAVAILABLE");

  failureStage = "GRANTS";
  await ownerSql.begin(async (transaction) => {
    for (let index = 0; index < permissionCodes.length; index += 1) {
      await transaction`
        insert into public.permission_grants(
          id,company_id,branch_id,subject_type,subject_id,permission_code,
          effect,valid_from,granted_by,reason
        ) values(
          ${grantIds[index]}::uuid,${principal.company_id}::uuid,${hotelId}::uuid,
          'USER',${principal.user_id}::uuid,${permissionCodes[index]},'ALLOW',
          statement_timestamp()-interval '1 minute',${principal.user_id}::uuid,
          'Preview 운영이슈 canary 권한'
        )
      `;
    }
  });
  grantsCreated = true;

  failureStage = "API_DB";
  const issueId = randomUUID();
  const title = `Preview 운영이슈 canary ${randomUUID()}`;
  let issue = await command(
    `/api/hotels/${hotelId}/issues`,
    {
      description: "Hosted Preview API·DB·UI 저장과 재조회 검증",
      issueId,
      roomId: null,
      severity: "MINOR",
      title,
    },
    "PREVIEW_OPERATIONAL_ISSUES_CREATE_INVALID",
  );
  if (
    issue.id !== issueId ||
    issue.status !== "RECEIVED" ||
    issue.title !== title
  )
    throw new Error("PREVIEW_OPERATIONAL_ISSUES_CREATE_READBACK_INVALID");

  const list = await api(`/api/hotels/${hotelId}/issues?page=1&pageSize=100`, {
    failureCode: "PREVIEW_OPERATIONAL_ISSUES_LIST_INVALID",
  });
  if (!list?.issues?.some((candidate) => candidate.id === issueId))
    throw new Error("PREVIEW_OPERATIONAL_ISSUES_LIST_READBACK_INVALID");

  issue = await command(
    `/api/hotels/${hotelId}/issues/${issueId}/assign`,
    {
      assigneeUserId: principal.user_id,
      reason: "Preview canary 자기 담당 지정",
      version: issue.version,
    },
    "PREVIEW_OPERATIONAL_ISSUES_ASSIGN_INVALID",
  );
  if (
    issue.status !== "ASSIGNED" ||
    issue.assignee?.userId !== principal.user_id
  )
    throw new Error("PREVIEW_OPERATIONAL_ISSUES_ASSIGN_READBACK_INVALID");

  issue = await command(
    `/api/hotels/${hotelId}/issues/${issueId}/transitions`,
    {
      action: "START",
      reason: "Preview canary 처리 시작",
      resumeDueAt: null,
      version: issue.version,
    },
    "PREVIEW_OPERATIONAL_ISSUES_START_INVALID",
  );
  issue = await command(
    `/api/hotels/${hotelId}/issues/${issueId}/work-logs`,
    { body: "Preview 현장 작업기록", version: issue.version },
    "PREVIEW_OPERATIONAL_ISSUES_WORK_LOG_INVALID",
  );
  issue = await command(
    `/api/hotels/${hotelId}/issues/${issueId}/public-comments`,
    { body: "Preview 공개댓글", version: issue.version },
    "PREVIEW_OPERATIONAL_ISSUES_PUBLIC_COMMENT_INVALID",
  );
  issue = await command(
    `/api/hotels/${hotelId}/issues/${issueId}/internal-notes`,
    { body: "Preview 내부메모", version: issue.version },
    "PREVIEW_OPERATIONAL_ISSUES_INTERNAL_NOTE_INVALID",
  );
  if (
    !issue.workLogs?.some((entry) => entry.body === "Preview 현장 작업기록") ||
    !issue.publicComments?.some((entry) => entry.body === "Preview 공개댓글") ||
    !issue.internalNotes?.some((entry) => entry.body === "Preview 내부메모")
  )
    throw new Error("PREVIEW_OPERATIONAL_ISSUES_ENTRY_READBACK_INVALID");

  issue = await command(
    `/api/hotels/${hotelId}/issues/${issueId}/transitions`,
    {
      action: "COMPLETE_ACTION",
      reason: "Preview canary 조치 완료",
      resumeDueAt: null,
      version: issue.version,
    },
    "PREVIEW_OPERATIONAL_ISSUES_COMPLETE_INVALID",
  );
  issue = await command(
    `/api/hotels/${hotelId}/issues/${issueId}/transitions`,
    {
      action: "CLOSE",
      reason: "Preview canary 확인 후 종료",
      resumeDueAt: null,
      version: issue.version,
    },
    "PREVIEW_OPERATIONAL_ISSUES_CLOSE_INVALID",
  );
  if (issue.status !== "CLOSED")
    throw new Error("PREVIEW_OPERATIONAL_ISSUES_CLOSE_READBACK_INVALID");

  const [databaseReadback] = await ownerSql`
    select
      issue.status,
      issue.version,
      exists(select 1 from public.hotel_issue_work_logs entry where entry.company_id=issue.company_id and entry.issue_id=issue.id and entry.body='Preview 현장 작업기록') as work_log_saved,
      exists(select 1 from public.hotel_issue_comments entry where entry.company_id=issue.company_id and entry.issue_id=issue.id and entry.body='Preview 공개댓글') as public_comment_saved,
      exists(select 1 from public.hotel_issue_internal_notes entry where entry.company_id=issue.company_id and entry.issue_id=issue.id and entry.body='Preview 내부메모') as internal_note_saved,
      exists(select 1 from public.audit_events audit where audit.company_id=issue.company_id and audit.resource_id=issue.id and audit.event_code='HOTEL_ISSUE_CLOSE') as close_audited
    from public.hotel_operational_issues issue
    where issue.company_id=${principal.company_id}::uuid and issue.id=${issueId}::uuid
  `;
  if (
    databaseReadback?.status !== "CLOSED" ||
    !databaseReadback.work_log_saved ||
    !databaseReadback.public_comment_saved ||
    !databaseReadback.internal_note_saved ||
    !databaseReadback.close_audited
  )
    throw new Error("PREVIEW_OPERATIONAL_ISSUES_DATABASE_READBACK_INVALID");
  console.log("PREVIEW_OPERATIONAL_ISSUES_API_DB_SMOKE_OK");

  failureStage = "UI";
  const uiCapabilities = await api("/api/issues/capabilities", {
    failureCode:
      "PREVIEW_OPERATIONAL_ISSUES_UI_CAPABILITIES_PREFLIGHT_INVALID",
  });
  if (!uiCapabilities?.hotels?.some((hotel) => hotel.hotelId === hotelId))
    throw new Error(
      "PREVIEW_OPERATIONAL_ISSUES_UI_CAPABILITIES_PREFLIGHT_INVALID",
    );
  await api(`/api/hotels/${hotelId}/assignments`, {
    failureCode: "PREVIEW_OPERATIONAL_ISSUES_UI_ASSIGNMENTS_PREFLIGHT_INVALID",
  });
  const uiList = await api(
    `/api/hotels/${hotelId}/issues?page=1&pageSize=100`,
    { failureCode: "PREVIEW_OPERATIONAL_ISSUES_UI_LIST_PREFLIGHT_INVALID" },
  );
  if (!uiList?.issues?.some((candidate) => candidate.id === issueId))
    throw new Error("PREVIEW_OPERATIONAL_ISSUES_UI_LIST_PREFLIGHT_INVALID");
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await context.addCookies([
    {
      httpOnly: true,
      name: "__Host-hotel_session",
      sameSite: "Lax",
      secure: true,
      url: baseUrl,
      value: token,
    },
  ]);
  const page = await context.newPage();
  const documentResponse = await page.goto(`${baseUrl}/hotels/${hotelId}/issues`, {
    timeout: 120_000,
    waitUntil: "domcontentloaded",
  });
  if (!documentResponse)
    throw new Error("PREVIEW_OPERATIONAL_ISSUES_UI_DOCUMENT_INVALID");
  if (new URL(page.url()).pathname === "/login")
    throw new Error("PREVIEW_OPERATIONAL_ISSUES_UI_LOGIN_REDIRECTED");
  if (new URL(page.url()).pathname === "/account/initial-password")
    throw new Error(
      "PREVIEW_OPERATIONAL_ISSUES_UI_PASSWORD_CHANGE_REDIRECTED",
    );
  if (documentResponse.status() === 404)
    throw new Error("PREVIEW_OPERATIONAL_ISSUES_UI_ROUTE_NOT_FOUND");
  if (!documentResponse.ok())
    throw new Error("PREVIEW_OPERATIONAL_ISSUES_UI_DOCUMENT_INVALID");
  const uiOutcome = await Promise.any([
    page
      .locator("[data-issue-workspace]")
      .waitFor({ state: "visible", timeout: 30_000 })
      .then(() => "WORKSPACE"),
    page
      .getByText("This page could not be found.", { exact: true })
      .waitFor({ state: "visible", timeout: 30_000 })
      .then(() => "PREVIEW_OPERATIONAL_ISSUES_UI_SOFT_NOT_FOUND"),
    page
      .getByRole("heading", { name: "호텔 화면을 불러오지 못했습니다" })
      .waitFor({ state: "visible", timeout: 30_000 })
      .then(() => "PREVIEW_OPERATIONAL_ISSUES_UI_ERROR_BOUNDARY"),
    page
      .getByRole("heading", {
        name: "운영이슈 화면을 불러오지 못했습니다",
      })
      .waitFor({ state: "visible", timeout: 30_000 })
      .then(() => "PREVIEW_OPERATIONAL_ISSUES_UI_DATA_LOAD_FAILED"),
  ]).catch(() => "PREVIEW_OPERATIONAL_ISSUES_UI_WORKSPACE_MISSING");
  if (uiOutcome !== "WORKSPACE") throw new Error(uiOutcome);
  const issueHeading = page.locator("#issue-title");
  await requireVisible(
    issueHeading,
    "PREVIEW_OPERATIONAL_ISSUES_UI_HEADING_MISSING",
  );
  if ((await issueHeading.textContent())?.trim() !== "운영이슈")
    throw new Error("PREVIEW_OPERATIONAL_ISSUES_UI_HEADING_MISSING");
  await requireVisible(
    page.getByText(title).first(),
    "PREVIEW_OPERATIONAL_ISSUES_UI_TITLE_MISSING",
  );
  await requireVisible(
    page.getByText("Preview 공개댓글"),
    "PREVIEW_OPERATIONAL_ISSUES_UI_PUBLIC_COMMENT_MISSING",
  );
  await requireVisible(
    page.getByText("Preview 현장 작업기록"),
    "PREVIEW_OPERATIONAL_ISSUES_UI_WORK_LOG_MISSING",
  );
  await requireVisible(
    page.getByText("Preview 내부메모"),
    "PREVIEW_OPERATIONAL_ISSUES_UI_INTERNAL_NOTE_MISSING",
  );
  if (
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
  )
    throw new Error("PREVIEW_OPERATIONAL_ISSUES_MOBILE_OVERFLOW");
  if (
    (await new AxeBuilder({ page }).include("[data-issue-workspace]").analyze())
      .violations.length
  )
    throw new Error("PREVIEW_OPERATIONAL_ISSUES_AXE_FAILED");
  await context.close();
  console.log("PREVIEW_OPERATIONAL_ISSUES_UI_SMOKE_OK");
} catch (error) {
  const code =
    error instanceof Error &&
    /^PREVIEW_OPERATIONAL_ISSUES_[A-Z_]+(?:_[A-Z_]+)?$/u.test(error.message)
      ? error.message
      : `PREVIEW_OPERATIONAL_ISSUES_FAILED_${failureStage}`;
  console.error(code);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => undefined);
  if (grantsCreated) {
    await ownerSql`
      delete from public.permission_grants
       where id = any(${grantIds}::uuid[])
    `.catch(() => {
      console.error("PREVIEW_OPERATIONAL_ISSUES_CLEANUP_GRANTS_FAILED");
      process.exitCode = 1;
    });
  }
  if (sessionCreated) {
    await sql`select * from public.auth_revoke_session_v2(${tokenHash}, 'Preview 운영이슈 smoke cleanup', ${randomUUID()}::uuid)`.catch(
      () => {
        console.error("PREVIEW_OPERATIONAL_ISSUES_CLEANUP_SESSION_FAILED");
        process.exitCode = 1;
      },
    );
  }
  await ownerSql.end({ timeout: 5 }).catch(() => undefined);
  await sql.end({ timeout: 5 }).catch(() => undefined);
}
