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
const reconcilerUrlFile = process.env.RECONCILER_DATABASE_URL_FILE?.trim();
if (
  !baseUrl?.startsWith("https://") ||
  !bootstrapSubject ||
  !apiUrlFile ||
  !reconcilerUrlFile
)
  throw new Error("PREVIEW_CALENDAR_SMOKE_CONFIGURATION_INVALID");

const databaseUrl = (await readFile(apiUrlFile, "utf8")).trim();
const reconcilerDatabaseUrl = (
  await readFile(reconcilerUrlFile, "utf8")
).trim();
const sql = postgres(databaseUrl, { max: 1, prepare: false });
const reconcilerSql = postgres(reconcilerDatabaseUrl, {
  max: 1,
  prepare: false,
});
const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token, "utf8").digest();
let browser;
let sessionCreated = false;
let companyId;
let actorUserId;

async function api(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      accept: "application/json",
      cookie: `__Host-hotel_session=${token}`,
    },
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok || payload?.ok !== true || payload?.error !== null)
    throw new Error("PREVIEW_CALENDAR_API_INVALID");
  return payload.data;
}

function assertExactKeys(value, expected, code) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(code);
  if (Object.keys(value).sort().join("\u0000") !== [...expected].sort().join("\u0000"))
    throw new Error(code);
  return value;
}
function parseRepairVisitMutationData(data) {
  const parsedData = assertExactKeys(
    data,
    ["visit"],
    "PREVIEW_CALENDAR_MUTATION_DATA_INVALID",
  );
  const visit = assertExactKeys(
    parsedData.visit,
    [
      "calendarProjectionStatus",
      "endsAt",
      "fileVersionIds",
      "id",
      "performer",
      "repairCaseId",
      "result",
      "startsAt",
      "status",
      "title",
      "unavailableReason",
      "version",
    ],
    "PREVIEW_CALENDAR_MUTATION_VISIT_INVALID",
  );
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
  const dateTime = (value) =>
    typeof value === "string" && Number.isFinite(Date.parse(value));
  const nullableString = (value) => value === null || typeof value === "string";
  const performer = assertExactKeys(
    visit.performer,
    visit.performer?.type === "INTERNAL"
      ? ["type", "userId"]
      : ["contactName", "contactPhone", "contractorName", "type"],
    "PREVIEW_CALENDAR_MUTATION_PERFORMER_INVALID",
  );
  const performerValid =
    (performer.type === "INTERNAL" && uuid.test(performer.userId ?? "")) ||
    (performer.type === "EXTERNAL" &&
      typeof performer.contractorName === "string" &&
      nullableString(performer.contactName) &&
      typeof performer.contactPhone === "string");
  if (
    !uuid.test(visit.id ?? "") ||
    !uuid.test(visit.repairCaseId ?? "") ||
    typeof visit.title !== "string" ||
    visit.title.length === 0 ||
    !dateTime(visit.startsAt) ||
    !dateTime(visit.endsAt) ||
    !["SCHEDULED", "COMPLETED", "CANCELLED", "DELETED"].includes(
      visit.status,
    ) ||
    !Number.isInteger(visit.version) ||
    visit.version < 1 ||
    !performerValid ||
    !nullableString(visit.result) ||
    !nullableString(visit.unavailableReason) ||
    !Array.isArray(visit.fileVersionIds) ||
    visit.fileVersionIds.some((id) => !uuid.test(id)) ||
    !["NOT_CONNECTED", "PENDING", "SYNCED", "ACTION_REQUIRED"].includes(
      visit.calendarProjectionStatus,
    )
  )
    throw new Error("PREVIEW_CALENDAR_MUTATION_VISIT_INVALID");
  return parsedData;
}
async function apiMutation(path, method, body, parseResponseData) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      cookie: `__Host-hotel_session=${token}`,
      "idempotency-key": randomUUID(),
    },
    body: JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => undefined);
  const envelope = assertExactKeys(
    payload,
    ["data", "error", "ok"],
    "PREVIEW_CALENDAR_MUTATION_INVALID",
  );
  if (!response.ok || envelope.ok !== true || envelope.error !== null)
    throw new Error("PREVIEW_CALENDAR_MUTATION_INVALID");
  return parseResponseData(envelope.data);
}

try {
  const rows = await sql`
    select * from public.auth_create_session_v2(
      ${randomUUID()}::uuid, ${tokenHash}, ${bootstrapSubject},
      28800, 86400, statement_timestamp(), ${randomUUID()}::uuid
    )
  `;
  if (
    rows.length !== 1 ||
    rows[0]?.result_status !== "CREATED" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      rows[0]?.company_id ?? "",
    )
  )
    throw new Error("PREVIEW_CALENDAR_SESSION_FAILED");
  companyId = rows[0].company_id;
  actorUserId = rows[0].user_id;
  sessionCreated = true;

  const capabilities = await api("/api/calendar/capabilities");
  if (
    capabilities?.canViewAllHotels !== true ||
    !Array.isArray(capabilities.hotels)
  )
    throw new Error("PREVIEW_CALENDAR_CAPABILITIES_INVALID");

  const connection = await api("/api/admin/calendar-connections");
  if (
    !Array.isArray(connection?.hotels) ||
    !Array.isArray(connection?.failures) ||
    typeof connection?.connectionStatus !== "string"
  )
    throw new Error("PREVIEW_CALENDAR_CONNECTION_RESPONSE_INVALID");
  const connectionStatuses = new Set([
    "NOT_CONNECTED",
    "CONNECTED",
    "RECONNECT_REQUIRED",
    "DISCONNECTED",
  ]);
  const credentialStatuses = new Set([
    "ACTIVE",
    "CANDIDATE",
    "ACCESS_VERIFIED",
    "ACCOUNT_CHANGE_REQUIRES_CONFIRMATION",
    "ACTION_REQUIRED",
  ]);
  const hotelLinkStatuses = new Set([
    "NOT_CREATED",
    "PENDING",
    "ACTIVE",
    "ACTION_REQUIRED",
    "DISCONNECTED",
  ]);
  const projectionStatuses = new Set([
    "NOT_CONNECTED",
    "PENDING",
    "SYNCED",
    "ACTION_REQUIRED",
  ]);
  if (
    !connectionStatuses.has(connection.connectionStatus) ||
    (connection.credentialStatus !== null &&
      !credentialStatuses.has(connection.credentialStatus)) ||
    connection.hotels.some(
      (hotel) =>
        !hotelLinkStatuses.has(hotel?.linkStatus) ||
        !projectionStatuses.has(hotel?.projectionStatus),
    )
  )
    throw new Error("PREVIEW_CALENDAR_STATUS_ENUM_INVALID");
  const candidatePairPresent =
    typeof connection.candidateId === "string" &&
    Number.isInteger(connection.candidateRowVersion) &&
    connection.candidateRowVersion > 0;
  const candidatePairAbsent =
    connection.candidateId === null && connection.candidateRowVersion === null;
  const candidateLifecycle = [
    "CANDIDATE",
    "ACCESS_VERIFIED",
    "ACCOUNT_CHANGE_REQUIRES_CONFIRMATION",
  ].includes(connection.credentialStatus);
  if (
    (!candidatePairPresent && !candidatePairAbsent) ||
    candidateLifecycle !== candidatePairPresent ||
    (connection.connectionStatus === "NOT_CONNECTED" &&
      (connection.connectionId !== null ||
        connection.version !== null ||
        connection.credentialStatus !== null)) ||
    (connection.connectionStatus === "DISCONNECTED" &&
      (typeof connection.connectionId !== "string" ||
        !Number.isInteger(connection.version) ||
        connection.credentialStatus !== null)) ||
    (["CONNECTED", "RECONNECT_REQUIRED"].includes(
      connection.connectionStatus,
    ) &&
      (typeof connection.connectionId !== "string" ||
        !Number.isInteger(connection.version) ||
        connection.credentialStatus === null))
  )
    throw new Error("PREVIEW_CALENDAR_CANDIDATE_PAIR_INVALID");
  for (const failure of connection.failures) {
    if (
      typeof failure?.failureId !== "string" ||
      !Number.isInteger(failure?.version) ||
      failure.version < 1 ||
      typeof failure?.hotelId !== "string"
    )
      throw new Error("PREVIEW_CALENDAR_FAILURE_IDENTITY_INVALID");
  }
  console.log("PREVIEW_CALENDAR_STRICT_STATUS_DTO_SMOKE_OK");
  if (
    /calendarId|credentialId|refreshToken|providerEventId/iu.test(
      JSON.stringify(connection),
    )
  )
    throw new Error("PREVIEW_CALENDAR_PROVIDER_IDENTIFIER_EXPOSED");

  const today = new Date();
  const from = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() - 7,
    ),
  );
  const to = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() + 35,
    ),
  );
  const query = new URLSearchParams({
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    pageSize: "200",
  });
  const calendar = await api(`/api/calendar?${query}`);
  if (
    calendar?.range?.timeZone !== "Asia/Seoul" ||
    !Array.isArray(calendar.events) ||
    !Array.isArray(calendar.hotels) ||
    typeof calendar.pagination?.nextCursor === "undefined"
  )
    throw new Error("PREVIEW_CALENDAR_RESPONSE_INVALID");
  const serialized = JSON.stringify(calendar);
  if (/providerEventId|calendarId|refreshToken/iu.test(serialized))
    throw new Error("PREVIEW_CALENDAR_PROVIDER_IDENTIFIER_EXPOSED");
  for (const event of calendar.events)
    if (
      event.type === "REPAIR_VISIT" &&
      !projectionStatuses.has(event.calendarProjectionStatus)
    )
      throw new Error("PREVIEW_CALENDAR_PROJECTION_STATE_INVALID");

  const oauthStart = await fetch(
    `${baseUrl}/api/admin/calendar-connections/oauth/start`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "idempotency-key": `calendar-oauth-smoke-${crypto.randomUUID()}`,
        cookie: `__Host-hotel_session=${token}`,
      },
      body: JSON.stringify({
        returnPath: "/admin/calendar",
        reconnect: connection.connectionId !== null,
        expectedConnectionVersion:
          connection.connectionId === null ? null : connection.version,
      }),
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    },
  );
  const oauthStartPayload = await oauthStart.json().catch(() => undefined);
  const bindingMatch = /__Host-hotel_calendar_oauth=([^;]+)/iu.exec(
    oauthStart.headers.get("set-cookie") ?? "",
  );
  const authorizationUrl = new URL(
    oauthStartPayload?.data?.authorizationUrl ?? "https://invalid.invalid",
  );
  const oauthState = authorizationUrl.searchParams.get("state");
  const oauthStartFailures = [];
  if (oauthStart.status !== 201)
    oauthStartFailures.push(
      `OAUTH_START_STATUS_${Number.isInteger(oauthStart.status) ? oauthStart.status : "OTHER"}`,
    );
  if (oauthStartPayload?.ok !== true) {
    const responseCode = oauthStartPayload?.error?.code;
    const safeResponseCode =
      typeof responseCode === "string" && /^[A-Z][A-Z0-9_]{0,63}$/u.test(responseCode)
        ? responseCode
        : "UNKNOWN";
    oauthStartFailures.push(`OAUTH_START_ENVELOPE_${safeResponseCode}`);
  }
  if (authorizationUrl.origin !== "https://accounts.google.com")
    oauthStartFailures.push("OAUTH_START_ORIGIN");
  if (!oauthState) oauthStartFailures.push("OAUTH_START_STATE");
  if (!bindingMatch?.[1]) oauthStartFailures.push("OAUTH_START_COOKIE");
  if (oauthStartFailures.length > 0)
    throw new Error(`PREVIEW_CALENDAR_${oauthStartFailures.join("__")}`);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const callback = await fetch(
      `${baseUrl}/api/admin/calendar-connections/oauth/callback?state=${encodeURIComponent(oauthState)}&error=access_denied`,
      {
        headers: {
          accept: "text/html",
          cookie: `__Host-hotel_session=${token}; __Host-hotel_calendar_oauth=${bindingMatch[1]}`,
        },
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (
      callback.status !== 303 ||
      callback.headers.get("location") !== "/admin/calendar" ||
      !/__Host-hotel_calendar_oauth=;[^\r\n]*Max-Age=0/iu.test(
        callback.headers.get("set-cookie") ?? "",
      )
    )
      throw new Error("PREVIEW_CALENDAR_OAUTH_TRANSACTION_REPLAY_INVALID");
  }
  console.log("PREVIEW_CALENDAR_OAUTH_TRANSACTION_REPLAY_SMOKE_OK");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const callback = await fetch(
      `${baseUrl}/api/admin/calendar-connections/oauth/callback?state=malformed-smoke-state&code=malformed-smoke-code`,
      {
        headers: {
          accept: "text/html",
          cookie: `__Host-hotel_session=${token}; __Host-hotel_calendar_oauth=malformed-smoke-binding`,
        },
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (
      callback.status !== 303 ||
      callback.headers.get("location") !== "/admin/calendar" ||
      !/__Host-hotel_calendar_oauth=;[^\r\n]*Max-Age=0/iu.test(
        callback.headers.get("set-cookie") ?? "",
      )
    )
      throw new Error("PREVIEW_CALENDAR_CALLBACK_REPLAY_INVALID");
  }
  const oauthStateHash = createHash("sha256")
    .update(oauthState, "utf8")
    .digest();
  const [oauthReplayEvidence] = await reconcilerSql.begin(
    async (transaction) => {
      await transaction`select set_config('app.reconciler_company_id', ${companyId}, true)`;
      return transaction`
      select * from public.calendar_projection_evidence_read_v1(
        ${companyId}::uuid,'OAUTH_REPLAY_ABSENT',${oauthStateHash},null,null,null,null
      )
    `;
    },
  );
  if (oauthReplayEvidence?.command_status !== "OK")
    throw new Error("PREVIEW_CALENDAR_CALLBACK_REPLAY_STATE_INVALID");
  console.log("PREVIEW_CALENDAR_CALLBACK_REPLAY_COOKIE_SMOKE_OK");

  const CANARY_REPAIR_TITLE = "Preview Calendar projection canary";
  const canaryRepairIdFromTitle = (title) => {
    const match = /^Preview Calendar projection canary:([0-9a-f-]{36})$/iu.exec(
      title,
    );
    return match?.[1] ?? null;
  };
  const existingCanary = calendar.events.find(
    (event) =>
      event.type === "REPAIR_VISIT" &&
      canaryRepairIdFromTitle(event.title) !== null &&
      event.canUpdate === true,
  );
  let canaryHotelId = existingCanary?.hotelId ?? null;
  let canaryRepairId = existingCanary
    ? canaryRepairIdFromTitle(existingCanary.title)
    : null;
  if (!canaryHotelId || !canaryRepairId) {
    for (const hotel of capabilities.hotels.filter(
      (candidate) => candidate.canCreateVisit === true,
    )) {
      const options = await api(
        `/api/hotels/${hotel.id}/calendar/visit-options`,
      );
      const repair = options?.repairs?.[0];
      const actorIsEligible = options?.internalPerformers?.some(
        (performer) => performer.userId === actorUserId,
      );
      if (typeof repair?.id === "string" && actorIsEligible) {
        canaryHotelId = hotel.id;
        canaryRepairId = repair.id;
        break;
      }
    }
  }
  if (!canaryHotelId || !canaryRepairId)
    throw new Error("PREVIEW_CALENDAR_CANARY_SOURCE_MISSING");
  const canaryTitle = `${CANARY_REPAIR_TITLE}:${canaryRepairId}`;
  let baselineJobId = null;
  if (existingCanary) {
    const [baseline] = await reconcilerSql.begin(async (transaction) => {
      await transaction`select set_config('app.reconciler_company_id', ${companyId}, true)`;
      return transaction`
        select * from public.calendar_projection_evidence_read_v1(
          ${companyId}::uuid,'EVENT_BASELINE',null,${existingCanary.id}::uuid,null,null,null
        )
      `;
    });
    if (baseline?.command_status !== "OK")
      throw new Error("PREVIEW_CALENDAR_CANARY_BASELINE_INVALID");
    baselineJobId = baseline.result_snapshot?.baselineJobId ?? null;
    if (typeof baselineJobId !== "string")
      throw new Error("PREVIEW_CALENDAR_CANARY_BASELINE_JOB_MISSING");
  }

  const startsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1_000);
  startsAt.setUTCSeconds(0, 0);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1_000);
  const canaryMutationStartedAt = new Date();
  let canaryVisit;
  if (existingCanary) {
    const detail = await api(
      `/api/hotels/${canaryHotelId}/repairs/${canaryRepairId}`,
    );
    const currentVisit = detail?.repair?.visits?.find(
      (visit) => visit.id === existingCanary.id,
    );
    if (!Number.isInteger(currentVisit?.version))
      throw new Error("PREVIEW_CALENDAR_CANARY_VERSION_MISSING");
    const mutation = await apiMutation(
      `/api/hotels/${canaryHotelId}/repair-visits/${existingCanary.id}`,
      "PATCH",
      {
        version: currentVisit.version,
        title: canaryTitle,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        performer: { type: "INTERNAL", userId: actorUserId },
        reason: "Preview Calendar projection release smoke",
      },
      parseRepairVisitMutationData,
    );
    canaryVisit = mutation?.visit;
  } else {
    const mutation = await apiMutation(
      `/api/hotels/${canaryHotelId}/repair-visits`,
      "POST",
      {
        repairCaseId: canaryRepairId,
        title: canaryTitle,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        performer: { type: "INTERNAL", userId: actorUserId },
      },
      parseRepairVisitMutationData,
    );
    canaryVisit = mutation?.visit;
  }
  if (
    typeof canaryVisit?.id !== "string" ||
    !Number.isInteger(canaryVisit?.version)
  )
    throw new Error("PREVIEW_CALENDAR_CANARY_MUTATION_INVALID");

  let syncedCanary;
  for (let attempt = 0; attempt < 42; attempt += 1) {
    const currentCalendar = await api(`/api/calendar?${query}`);
    syncedCanary = currentCalendar.events?.find(
      (event) =>
        event.type === "REPAIR_VISIT" &&
        event.id === canaryVisit.id &&
        event.title === canaryTitle &&
        event.calendarProjectionStatus === "SYNCED",
    );
    if (syncedCanary) break;
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  if (!syncedCanary)
    throw new Error("PREVIEW_CALENDAR_CANARY_RECONCILIATION_TIMEOUT");

  const [projectionEvidence] = await reconcilerSql.begin(
    async (transaction) => {
      await transaction`select set_config('app.reconciler_company_id', ${companyId}, true)`;
      return transaction`
      select * from public.calendar_projection_evidence_read_v1(
        ${companyId}::uuid,'EVENT_FINAL',null,${canaryVisit.id}::uuid,
        ${canaryVisit.version},${baselineJobId}::uuid,${canaryMutationStartedAt}
      )
    `;
    },
  );
  const projectionChains = projectionEvidence?.result_snapshot;
  if (
    projectionEvidence?.command_status !== "OK" ||
    projectionChains?.hotelId !== syncedCanary.hotelId ||
    connection.connectionId === null ||
    !connection.hotels.some(
      (hotel) =>
        hotel.hotelId === projectionChains?.hotelId &&
        hotel.projectionStatus === "SYNCED",
    )
  )
    throw new Error("PREVIEW_CALENDAR_PROJECTION_EVIDENCE_MISSING");
  console.log("PREVIEW_CALENDAR_PROJECTION_EVIDENCE_SMOKE_OK");

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await context.addCookies([
    {
      name: "__Host-hotel_session",
      value: token,
      url: baseUrl,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/hotels/calendar`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page
    .getByRole("heading", { name: "업무 달력" })
    .waitFor({ state: "visible", timeout: 120_000 });
  await page
    .getByRole("button", { name: "월간" })
    .waitFor({ state: "visible" });
  await page
    .getByRole("button", { name: "주간" })
    .waitFor({ state: "visible" });
  if (
    (
      await new AxeBuilder({ page })
        .include("section[aria-labelledby=calendar-title]")
        .analyze()
    ).violations.length
  )
    throw new Error("PREVIEW_CALENDAR_AXE_FAILED");
  await page.goto(`${baseUrl}/admin/calendar`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page
    .getByRole("heading", { name: "Google Calendar 연결" })
    .waitFor({ state: "visible", timeout: 120_000 });
  await page.getByLabel("변경 사유").waitFor({ state: "visible" });
  await page
    .getByRole("button", { name: /Google 계정 연결|재연결/u })
    .waitFor({ state: "visible" });
  await page.setViewportSize({ width: 390, height: 844 });
  const connectButton = page.getByRole("button", {
    name: /Google 계정 연결|재연결/u,
  });
  const connectBox = await connectButton.boundingBox();
  if (!connectBox || connectBox.height < 44 || connectBox.width < 44)
    throw new Error("PREVIEW_CALENDAR_TOUCH_TARGET_INVALID");
  const guideButton = page.getByRole("button", {
    name: "Google Calendar 연결 도움말",
  });
  await guideButton.waitFor({ state: "visible" });
  const guideBox = await guideButton.boundingBox();
  if (!guideBox || guideBox.height < 44 || guideBox.width < 44)
    throw new Error("PREVIEW_CALENDAR_GUIDE_TOUCH_TARGET_INVALID");
  await guideButton.focus();
  await guideButton.press("Enter");
  await page
    .getByRole("heading", { name: "Google Calendar 연결 도움말" })
    .waitFor({ state: "visible" });
  if ((await new AxeBuilder({ page }).analyze()).violations.length)
    throw new Error("PREVIEW_CALENDAR_GUIDE_AXE_FAILED");
  await page.keyboard.press("Escape");
  if (
    !(await guideButton.evaluate(
      (element) => element === document.activeElement,
    ))
  )
    throw new Error("PREVIEW_CALENDAR_GUIDE_FOCUS_RETURN_FAILED");
  if (
    (
      await new AxeBuilder({ page })
        .include("section[aria-labelledby=calendar-connection-title]")
        .analyze()
    ).violations.length
  )
    throw new Error("PREVIEW_CALENDAR_CONNECTION_AXE_FAILED");
  await context.close();
  console.log("PREVIEW_CALENDAR_API_UI_SMOKE_OK");
} catch (error) {
  const code =
    error instanceof Error && /^PREVIEW_CALENDAR_[A-Z0-9_]+$/u.test(error.message)
      ? error.message
      : "PREVIEW_CALENDAR_UNCLASSIFIED";
  console.error(code);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => undefined);
  if (sessionCreated) {
    await sql`select * from public.auth_revoke_session_v2(${tokenHash}, 'Preview Calendar smoke cleanup', ${randomUUID()}::uuid)`.catch(
      () => {
        process.exitCode = 1;
      },
    );
  }
  await reconcilerSql.end({ timeout: 5 }).catch(() => undefined);
  await sql.end({ timeout: 5 }).catch(() => undefined);
}
