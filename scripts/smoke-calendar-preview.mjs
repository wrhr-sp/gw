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
const mutationMode = process.env.PREVIEW_CALENDAR_REQUIRE_MUTATION?.trim();
const ownerDatabaseUrl =
  process.env.PREVIEW_CALENDAR_OWNER_DATABASE_URL?.trim();
if (mutationMode && mutationMode !== "1")
  throw new Error("PREVIEW_CALENDAR_SMOKE_CONFIGURATION_INVALID");
const requireMutation = mutationMode === "1";
const canaryCommonAreaId = "75000000-0000-4000-8000-000000000002";
const canaryPriorityId = "76000000-0000-4000-8000-000000000002";
const HOTEL_REPAIR_CASE_COMMAND_V1_SHA256 =
  "66146354b5e78564d9c1ff364aab6d1d2867a930d80a6948d4f158dff13f7f6c";
const repairCaseCatchAll = `exception when sqlstate '55000' then return query select case when sqlerrm in ('REPAIR_EVIDENCE_REQUIRED','REPAIR_FOLLOW_UP_INVALID','REPAIR_COMPLETED_LOCKED') then sqlerrm else 'REPAIR_FOLLOW_UP_INVALID' end,null::jsonb; when foreign_key_violation or check_violation or invalid_text_representation then return query select 'REPAIR_FOLLOW_UP_INVALID',null::jsonb;`;
if (
  !baseUrl?.startsWith("https://") ||
  !bootstrapSubject ||
  !apiUrlFile ||
  (requireMutation && !ownerDatabaseUrl)
)
  throw new Error("PREVIEW_CALENDAR_SMOKE_CONFIGURATION_INVALID");

const databaseUrl = (await readFile(apiUrlFile, "utf8")).trim();
const sql = postgres(databaseUrl, { max: 1, prepare: false });
const ownerSql = requireMutation
  ? postgres(ownerDatabaseUrl, { max: 1, prepare: false })
  : null;
const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token, "utf8").digest();
const sessionId = randomUUID();
let browser;
let sessionCreated = false;
let createdVisit = null;
let createdVisitHotelId = null;

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
    const safeErrorCode =
      options.includeSafeErrorCode && /^[A-Z_]+$/u.test(payload?.error?.code)
        ? payload.error.code
        : null;
    throw new Error(
      `${options.failureCode ?? "PREVIEW_CALENDAR_API_INVALID"}${safeErrorCode ? `_${safeErrorCode}` : ""}`,
    );
  }
  return payload.data;
}

async function diagnoseCreateDirectConstraint({ companyId, hotelId, value }) {
  if (!ownerSql)
    throw new Error("PREVIEW_CALENDAR_TEMP_CLONE_CONFIGURATION_INVALID");
  const rollbackSignal = new Error("PREVIEW_CALENDAR_TEMP_CLONE_ROLLBACK");
  let diagnosticMarker = null;
  try {
    await ownerSql.begin(async (transaction) => {
      const [functionRecord] = await transaction`
        select pg_catalog.pg_get_functiondef(function_record.oid) as definition,
               pg_catalog.encode(
                 pg_catalog.sha256(
                   pg_catalog.convert_to(function_record.prosrc, 'UTF8')
                 ),
                 'hex'
               ) as source_sha256
          from pg_catalog.pg_proc function_record
         where function_record.oid = pg_catalog.to_regprocedure(
           'public.hotel_repair_case_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)'
         )
      `;
      if (
        functionRecord?.source_sha256 !== HOTEL_REPAIR_CASE_COMMAND_V1_SHA256 ||
        typeof functionRecord.definition !== "string"
      )
        throw new Error("PREVIEW_CALENDAR_TEMP_CLONE_SOURCE_INVALID");
      const canonicalHeader =
        "CREATE OR REPLACE FUNCTION public.hotel_repair_case_command_v1(";
      const temporaryHeader =
        "CREATE OR REPLACE FUNCTION pg_temp.preview_hotel_repair_case_probe_v1(";
      if (
        functionRecord.definition.indexOf(canonicalHeader) < 0 ||
        functionRecord.definition.indexOf(canonicalHeader) !==
          functionRecord.definition.lastIndexOf(canonicalHeader) ||
        functionRecord.definition.indexOf(repairCaseCatchAll) < 0 ||
        functionRecord.definition.indexOf(repairCaseCatchAll) !==
          functionRecord.definition.lastIndexOf(repairCaseCatchAll)
      )
        throw new Error("PREVIEW_CALENDAR_TEMP_CLONE_SOURCE_INVALID");
      const diagnosticDefinition = functionRecord.definition
        .replace(canonicalHeader, temporaryHeader)
        .replace(repairCaseCatchAll, "exception when others then raise;");
      await transaction.unsafe(
        "create temporary table preview_calendar_temp_schema_guard(id integer) on commit drop",
      );
      await transaction.unsafe(diagnosticDefinition);
      await transaction`
        select set_config('app.company_id', ${companyId}, true),
               set_config('app.session_id', ${sessionId}, true),
               set_config('TimeZone', 'Asia/Seoul', true)
      `;
      await transaction.unsafe("savepoint preview_calendar_constraint_probe");
      try {
        const probeRows = await transaction`
          select * from pg_temp.preview_hotel_repair_case_probe_v1(
            ${companyId}::uuid,
            ${hotelId}::uuid,
            ${value.repairCaseId}::uuid,
            ${"CREATE_DIRECT"},
            0,
            ${transaction.json(value)}::jsonb,
            ${token},
            ${randomUUID()}::uuid,
            ${randomUUID()},
            ${"POST"},
            ${`/api/hotels/${hotelId}/repairs`},
            ${createHash("sha256").update(JSON.stringify(value)).digest("hex")},
            ${randomUUID()}::uuid,
            ${randomUUID()}::uuid
          )
        `;
        const safeStatus =
          typeof probeRows[0]?.command_status === "string" &&
          /^[A-Z_]+$/u.test(probeRows[0].command_status)
            ? probeRows[0].command_status
            : "UNKNOWN";
        diagnosticMarker = `PREVIEW_CALENDAR_TEMP_CLONE_SQLSTATE_NONE_CONSTRAINT_NONE_STATUS_${safeStatus}`;
      } catch (constraintError) {
        const errorRecord =
          constraintError && typeof constraintError === "object"
            ? constraintError
            : {};
        const sqlstate =
          typeof errorRecord.code === "string" &&
          /^[0-9A-Z]{5}$/u.test(errorRecord.code)
            ? errorRecord.code
            : "UNKNOWN";
        const rawConstraint =
          typeof errorRecord.constraint_name === "string"
            ? errorRecord.constraint_name
            : typeof errorRecord.constraint === "string"
              ? errorRecord.constraint
              : "NONE";
        const constraint = /^[A-Za-z0-9_]{1,128}$/u.test(rawConstraint)
          ? rawConstraint.toUpperCase()
          : "UNKNOWN";
        diagnosticMarker = `PREVIEW_CALENDAR_TEMP_CLONE_SQLSTATE_${sqlstate}_CONSTRAINT_${constraint}`;
      } finally {
        await transaction.unsafe(
          "rollback to savepoint preview_calendar_constraint_probe",
        );
      }
      const readRows = await transaction`
        select * from public.hotel_repair_read_v1(
          ${companyId}::uuid,
          ${hotelId}::uuid,
          ${value.repairCaseId}::uuid,
          ${transaction.json({})}::jsonb,
          ${token}
        )
      `;
      if (
        readRows.length !== 1 ||
        readRows[0]?.command_status !== "NOT_FOUND" ||
        readRows[0]?.result_snapshot !== null
      )
        throw new Error("PREVIEW_CALENDAR_TEMP_CLONE_ROLLBACK_INVALID");
      throw rollbackSignal;
    });
  } catch (diagnosticError) {
    if (diagnosticError !== rollbackSignal)
      throw new Error("PREVIEW_CALENDAR_TEMP_CLONE_PROBE_FAILED");
  }
  const [temporaryFunctionState] = await ownerSql`
    select pg_catalog.to_regprocedure(
      'pg_temp.preview_hotel_repair_case_probe_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)'
    ) is null as absent
  `;
  if (!temporaryFunctionState?.absent || !diagnosticMarker)
    throw new Error("PREVIEW_CALENDAR_TEMP_CLONE_ROLLBACK_INVALID");
  console.log("PREVIEW_CALENDAR_TEMP_CLONE_ROLLBACK_OK");
  console.log(diagnosticMarker);
  throw new Error("PREVIEW_CALENDAR_TEMP_CLONE_DIAGNOSTIC_CAPTURED");
}

async function probeCreateDirectRollback({ companyId, hotelId, value }) {
  const repairCaseId = value.repairCaseId;
  const rollbackSignal = new Error("PREVIEW_CALENDAR_EXPECTED_ROLLBACK");
  let commandStatus = null;
  try {
    await sql.begin(async (transaction) => {
      await transaction`
        select set_config('app.company_id', ${companyId}, true),
               set_config('app.session_id', ${sessionId}, true),
               set_config('TimeZone', 'Asia/Seoul', true)
      `;
      const rows = await transaction`
        select * from public.hotel_repair_case_command_v1(
          ${companyId}::uuid,
          ${hotelId}::uuid,
          ${repairCaseId}::uuid,
          ${"CREATE_DIRECT"},
          0,
          ${transaction.json(value)}::jsonb,
          ${token},
          ${randomUUID()}::uuid,
          ${randomUUID()},
          ${"POST"},
          ${`/api/hotels/${hotelId}/repairs`},
          ${createHash("sha256").update(JSON.stringify(value)).digest("hex")},
          ${randomUUID()}::uuid,
          ${randomUUID()}::uuid
        )
      `;
      commandStatus = rows.length === 1 ? rows[0]?.command_status : null;
      throw rollbackSignal;
    });
  } catch (probeError) {
    if (probeError !== rollbackSignal)
      throw new Error("PREVIEW_CALENDAR_CREATE_DIRECT_PROBE_FAILED");
  }

  const readRows = await sql.begin(async (transaction) => {
    await transaction`
      select set_config('app.company_id', ${companyId}, true),
             set_config('app.session_id', ${sessionId}, true),
             set_config('TimeZone', 'Asia/Seoul', true)
    `;
    return transaction`
      select * from public.hotel_repair_read_v1(
        ${companyId}::uuid,
        ${hotelId}::uuid,
        ${repairCaseId}::uuid,
        ${transaction.json({})}::jsonb,
        ${token}
      )
    `;
  });
  if (
    readRows.length !== 1 ||
    readRows[0]?.command_status !== "NOT_FOUND" ||
    readRows[0]?.result_snapshot !== null
  )
    throw new Error("PREVIEW_CALENDAR_CREATE_DIRECT_ROLLBACK_INVALID");
  if (commandStatus !== "CREATED") {
    await diagnoseCreateDirectConstraint({ companyId, hotelId, value });
    const safeStatus =
      typeof commandStatus === "string" && /^[A-Z_]+$/u.test(commandStatus)
        ? commandStatus
        : "UNKNOWN";
    throw new Error(
      `PREVIEW_CALENDAR_CREATE_DIRECT_ROLLBACK_INVALID_${safeStatus}`,
    );
  }
  console.log("PREVIEW_CALENDAR_CREATE_DIRECT_ROLLBACK_OK");
}

try {
  const rows = await sql`
    select * from public.auth_create_session_v2(
      ${sessionId}::uuid, ${tokenHash}, ${bootstrapSubject},
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
  sessionCreated = true;

  const capabilities = await api("/api/calendar/capabilities");
  if (
    capabilities?.canViewAllHotels !== true ||
    !Array.isArray(capabilities.hotels)
  )
    throw new Error("PREVIEW_CALENDAR_CAPABILITIES_INVALID");

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

  if (requireMutation) {
    if (capabilities.hotels.length === 0)
      throw new Error("PREVIEW_CALENDAR_MUTATION_HOTEL_UNAVAILABLE");
    const hotel = capabilities.hotels.find(
      (candidate) => candidate.canCreateVisit,
    );
    if (!hotel?.id)
      throw new Error(
        "PREVIEW_CALENDAR_MUTATION_CREATE_PERMISSION_UNAVAILABLE",
      );
    const hotelId = hotel.id;
    const options = await api(`/api/hotels/${hotelId}/calendar/visit-options`, {
      failureCode: "PREVIEW_CALENDAR_MUTATION_OPTIONS_API_INVALID",
    });
    let repair = options?.repairs?.find(
      (candidate) =>
        candidate.targetName === "Preview Calendar 검증구역" &&
        candidate.priorityName === "Preview Calendar 검증",
    );
    const performer = options?.internalPerformers?.[0];
    if (!performer?.userId)
      throw new Error("PREVIEW_CALENDAR_MUTATION_PERFORMER_UNAVAILABLE");
    if (!repair?.id) {
      const repairBody = {
        followUpOfRepairCaseId: null,
        followUpParentVersion: null,
        priorityId: canaryPriorityId,
        repairCaseId: randomUUID(),
        source: {
          description: "Preview Calendar 저장·재조회 검증",
          fileVersionIds: [],
          type: "DIRECT",
          unavailableReason: "Preview canary에는 첨부파일이 없습니다.",
        },
        target: {
          commonAreaId: canaryCommonAreaId,
          type: "COMMON_AREA",
        },
      };
      await probeCreateDirectRollback({
        companyId: rows[0].company_id,
        hotelId,
        value: repairBody,
      });
      const createdRepair = await api(`/api/hotels/${hotelId}/repairs`, {
        body: repairBody,
        idempotencyKey: randomUUID(),
        includeSafeErrorCode: true,
        method: "POST",
        failureCode: "PREVIEW_CALENDAR_MUTATION_REPAIR_CREATE_API_INVALID",
      });
      repair = createdRepair?.repair ?? createdRepair;
    }
    if (!repair?.id || repair.status !== "OPEN")
      throw new Error("PREVIEW_CALENDAR_MUTATION_CREATED_REPAIR_INVALID");

    const startsAt = new Date(Date.now() + 3_600_000);
    startsAt.setUTCSeconds(0, 0);
    const endsAt = new Date(startsAt.getTime() + 1_800_000);
    const title = `Preview Calendar canary ${randomUUID()}`;
    const createKey = randomUUID();
    const created = await api(`/api/hotels/${hotelId}/repair-visits`, {
      body: {
        endsAt: endsAt.toISOString(),
        performer: { type: "INTERNAL", userId: performer.userId },
        repairCaseId: repair.id,
        startsAt: startsAt.toISOString(),
        title,
      },
      idempotencyKey: createKey,
      method: "POST",
      failureCode: "PREVIEW_CALENDAR_MUTATION_VISIT_CREATE_API_INVALID",
    });
    createdVisit = created?.visit;
    createdVisitHotelId = hotelId;
    const visitId = createdVisit?.id;
    if (
      !visitId ||
      createdVisit.repairCaseId !== repair.id ||
      createdVisit.title !== title ||
      createdVisit.status !== "SCHEDULED"
    )
      throw new Error("PREVIEW_CALENDAR_MUTATION_READBACK_INVALID");

    const detail = await api(`/api/hotels/${hotelId}/repairs/${repair.id}`, {
      failureCode: "PREVIEW_CALENDAR_MUTATION_DETAIL_READ_API_INVALID",
    });
    if (
      !detail?.repair?.visits?.some(
        (visit) => visit.id === visitId && visit.title === title,
      )
    )
      throw new Error("PREVIEW_CALENDAR_MUTATION_READBACK_INVALID");
    const hotelCalendar = await api(
      `/api/hotels/${hotelId}/calendar?${query}`,
      {
        failureCode: "PREVIEW_CALENDAR_MUTATION_HOTEL_READ_API_INVALID",
      },
    );
    if (
      !hotelCalendar?.events?.some(
        (event) =>
          event.type === "REPAIR_VISIT" &&
          event.id === visitId &&
          event.title === title &&
          event.startsAt === startsAt.toISOString() &&
          event.endsAt === endsAt.toISOString(),
      )
    )
      throw new Error("PREVIEW_CALENDAR_MUTATION_READBACK_INVALID");

    const denied = await request(
      `/api/hotels/50000000-0000-4000-8000-000000000099/calendar?${query}`,
    );
    if (
      denied.response.status !== 403 ||
      denied.payload?.ok !== false ||
      denied.payload?.data !== null
    )
      throw new Error("PREVIEW_CALENDAR_PERMISSION_DENY_INVALID");

    await api(`/api/hotels/${hotelId}/repair-visits/${visitId}/delete`, {
      body: {
        reason: "Preview Calendar canary cleanup",
        version: createdVisit.version,
      },
      idempotencyKey: randomUUID(),
      method: "POST",
      failureCode: "PREVIEW_CALENDAR_MUTATION_VISIT_DELETE_API_INVALID",
    });
    createdVisit = null;
    const afterDelete = await api(`/api/hotels/${hotelId}/calendar?${query}`, {
      failureCode: "PREVIEW_CALENDAR_MUTATION_AFTER_DELETE_READ_API_INVALID",
    });
    if (afterDelete?.events?.some((event) => event.id === visitId))
      throw new Error("PREVIEW_CALENDAR_MUTATION_READBACK_INVALID");
    console.log("PREVIEW_CALENDAR_MUTATION_SMOKE_OK");
  }

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
  await context.close();
  console.log("PREVIEW_CALENDAR_API_UI_SMOKE_OK");
} catch (error) {
  const code =
    error instanceof Error && /^PREVIEW_CALENDAR_[A-Z_]+$/u.test(error.message)
      ? error.message
      : "PREVIEW_CALENDAR_UNCLASSIFIED";
  console.error(code);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => undefined);
  if (createdVisit?.id && createdVisitHotelId) {
    await api(
      `/api/hotels/${createdVisitHotelId}/repair-visits/${createdVisit.id}/delete`,
      {
        body: {
          reason: "Preview Calendar failed canary cleanup",
          version: createdVisit.version,
        },
        idempotencyKey: randomUUID(),
        method: "POST",
      },
    ).catch(() => {
      process.exitCode = 1;
    });
  }
  if (sessionCreated) {
    await sql`select * from public.auth_revoke_session_v2(${tokenHash}, 'Preview Calendar smoke cleanup', ${randomUUID()}::uuid)`.catch(
      () => {
        process.exitCode = 1;
      },
    );
  }
  if (ownerSql) await ownerSql.end({ timeout: 5 }).catch(() => undefined);
  await sql.end({ timeout: 5 }).catch(() => undefined);
}
