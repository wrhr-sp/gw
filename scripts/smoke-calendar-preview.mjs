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
if (mutationMode && mutationMode !== "1")
  throw new Error("PREVIEW_CALENDAR_SMOKE_CONFIGURATION_INVALID");
const requireMutation = mutationMode === "1";
if (!baseUrl?.startsWith("https://") || !bootstrapSubject || !apiUrlFile)
  throw new Error("PREVIEW_CALENDAR_SMOKE_CONFIGURATION_INVALID");

const databaseUrl = (await readFile(apiUrlFile, "utf8")).trim();
const sql = postgres(databaseUrl, { max: 1, prepare: false });
const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token, "utf8").digest();
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
  if (!response.ok || payload?.ok !== true || payload?.error !== null)
    throw new Error("PREVIEW_CALENDAR_API_INVALID");
  return payload.data;
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
    const hotel = capabilities.hotels.find(
      (candidate) => candidate.canCreateVisit,
    );
    if (!hotel?.id)
      throw new Error("PREVIEW_CALENDAR_MUTATION_FIXTURE_UNAVAILABLE");
    const hotelId = hotel.id;
    const options = await api(`/api/hotels/${hotelId}/calendar/visit-options`);
    const repair = options?.repairs?.[0];
    const performer = options?.internalPerformers?.[0];
    if (!repair?.id || !performer?.userId)
      throw new Error("PREVIEW_CALENDAR_MUTATION_FIXTURE_UNAVAILABLE");

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

    const detail = await api(`/api/hotels/${hotelId}/repairs/${repair.id}`);
    if (
      !detail?.repair?.visits?.some(
        (visit) => visit.id === visitId && visit.title === title,
      )
    )
      throw new Error("PREVIEW_CALENDAR_MUTATION_READBACK_INVALID");
    const hotelCalendar = await api(`/api/hotels/${hotelId}/calendar?${query}`);
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
    });
    createdVisit = null;
    const afterDelete = await api(`/api/hotels/${hotelId}/calendar?${query}`);
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
  await sql.end({ timeout: 5 }).catch(() => undefined);
}
