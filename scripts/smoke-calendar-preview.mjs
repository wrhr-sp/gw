import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";

const requireFromDb = createRequire(new URL("../packages/db/package.json", import.meta.url));
const requireFromWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const postgres = requireFromDb("postgres");
const axeModule = requireFromWeb("@axe-core/playwright");
const AxeBuilder = axeModule.default ?? axeModule;

const baseUrl = process.env.WEB_PREVIEW_URL?.trim().replace(/\/+$/u, "");
const bootstrapSubject = process.env.ZITADEL_PREVIEW_SUBJECT?.trim();
const apiUrlFile = process.env.API_RUNTIME_DATABASE_URL_FILE?.trim();
const reconcilerUrlFile = process.env.RECONCILER_DATABASE_URL_FILE?.trim();
if (!baseUrl?.startsWith("https://") || !bootstrapSubject || !apiUrlFile || !reconcilerUrlFile)
  throw new Error("PREVIEW_CALENDAR_SMOKE_CONFIGURATION_INVALID");

const databaseUrl = (await readFile(apiUrlFile, "utf8")).trim();
const reconcilerDatabaseUrl = (await readFile(reconcilerUrlFile, "utf8")).trim();
const sql = postgres(databaseUrl, { max: 1, prepare: false });
const reconcilerSql = postgres(reconcilerDatabaseUrl, { max: 1, prepare: false });
const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token, "utf8").digest();
let browser;
let sessionCreated = false;
let companyId;

async function api(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { accept: "application/json", cookie: `__Host-hotel_session=${token}` },
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => undefined);
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
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(rows[0]?.company_id ?? "")
  )
    throw new Error("PREVIEW_CALENDAR_SESSION_FAILED");
  companyId = rows[0].company_id;
  sessionCreated = true;

  const capabilities = await api("/api/calendar/capabilities");
  if (capabilities?.canViewAllHotels !== true || !Array.isArray(capabilities.hotels))
    throw new Error("PREVIEW_CALENDAR_CAPABILITIES_INVALID");

  const today = new Date();
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 7));
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 35));
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
  ) throw new Error("PREVIEW_CALENDAR_RESPONSE_INVALID");
  const serialized = JSON.stringify(calendar);
  if (/providerEventId|calendarId|refreshToken/iu.test(serialized))
    throw new Error("PREVIEW_CALENDAR_PROVIDER_IDENTIFIER_EXPOSED");
  for (const event of calendar.events) {
    if (event.type === "REPAIR_VISIT" && event.calendarProjectionStatus !== "NOT_CONNECTED")
      throw new Error("PREVIEW_CALENDAR_PROJECTION_STATE_INVALID");
  }

  const [providerJobCount] = await reconcilerSql.begin(async (transaction) => {
    await transaction`select set_config('app.company_id', ${companyId}, true)`;
    return transaction`
      select count(*)::integer as count from public.outbox_jobs
       where job_type like 'CALENDAR_%'
    `;
  });
  if (providerJobCount?.count !== 0)
    throw new Error("PREVIEW_CALENDAR_PROVIDER_JOB_CREATED");

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([{ name: "__Host-hotel_session", value: token, url: baseUrl, httpOnly: true, secure: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/hotels/calendar`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByRole("heading", { name: "업무 달력" }).waitFor({ state: "visible", timeout: 120_000 });
  await page.getByRole("button", { name: "월간" }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "주간" }).waitFor({ state: "visible" });
  if ((await new AxeBuilder({ page }).include("section[aria-labelledby=calendar-title]").analyze()).violations.length)
    throw new Error("PREVIEW_CALENDAR_AXE_FAILED");
  await context.close();
  console.log("PREVIEW_CALENDAR_API_UI_SMOKE_OK");
} catch (error) {
  const code = error instanceof Error && /^PREVIEW_CALENDAR_[A-Z_]+$/u.test(error.message)
    ? error.message
    : "PREVIEW_CALENDAR_UNCLASSIFIED";
  console.error(code);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => undefined);
  if (sessionCreated) {
    await sql`select * from public.auth_revoke_session_v2(${tokenHash}, 'Preview Calendar smoke cleanup', ${randomUUID()}::uuid)`
      .catch(() => { process.exitCode = 1; });
  }
  await reconcilerSql.end({ timeout: 5 }).catch(() => undefined);
  await sql.end({ timeout: 5 }).catch(() => undefined);
}
