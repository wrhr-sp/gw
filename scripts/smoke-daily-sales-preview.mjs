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
  throw new Error("PREVIEW_DAILY_SALES_CONFIGURATION_INVALID");
const sql = postgres((await readFile(apiUrlFile, "utf8")).trim(), {
  max: 1,
  prepare: false,
});
const ownerSql = postgres(ownerDatabaseUrl, { max: 1, prepare: false });
const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token, "utf8").digest();
const sessionId = randomUUID();
const canaryCategoryName = "Preview 일매출 canary 매출";
const canaryPaymentMethodName = "Preview 일매출 canary 결제";
const permissionCodes = [
  "HOTEL_SALES_VIEW",
  "HOTEL_SALES_MANAGE",
  "HOTEL_SALES_CONFIRM",
  "HOTEL_SALES_CORRECT",
  "HOTEL_FILE_UPLOAD",
  "HOTEL_FILE_READ",
];
let createdGrantIds = [];
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
let browser;
let sessionCreated = false;
let grantsCreated = false;
let failureStage = "SESSION";
let hotelId;

async function request(path, options = {}) {
  const headers = {
    accept: "application/json",
    cookie: `__Host-hotel_session=${token}`,
    ...(options.headers ?? {}),
  };
  if (options.body !== undefined && !headers["content-type"])
    headers["content-type"] = "application/json";
  if (options.idempotencyKey)
    headers["idempotency-key"] = options.idempotencyKey;
  const response = await fetch(`${baseUrl}${path}`, {
    body:
      options.rawBody ??
      (options.body === undefined ? undefined : JSON.stringify(options.body)),
    headers,
    method: options.method ?? "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  return {
    payload: options.raw
      ? undefined
      : await response.json().catch(() => undefined),
    response,
  };
}
async function api(path, options = {}) {
  const { payload, response } = await request(path, options);
  if (!response.ok || payload?.ok !== true || payload?.error !== null) {
    const safe = /^[A-Z_]+$/u.test(payload?.error?.code)
      ? `_${payload.error.code}`
      : "";
    throw new Error(
      `${options.failureCode ?? "PREVIEW_DAILY_SALES_API_INVALID"}${safe}`,
    );
  }
  return payload.data;
}
async function command(path, method, body, failureCode) {
  const data = await api(path, {
    body,
    failureCode,
    idempotencyKey: randomUUID(),
    method,
  });
  if (!data?.sales?.id || typeof data.sales.version !== "number")
    throw new Error(`${failureCode}_RESPONSE_INVALID`);
  return data.sales;
}
async function uploadEvidence(salesId, label) {
  const initialized = await api(`/api/hotels/${hotelId}/files/upload-init`, {
    body: {
      parent: { type: "DAILY_SALES_EVIDENCE", salesId },
      fileName: `${label}.png`,
      mimeType: "image/png",
      sizeBytes: png.length,
    },
    failureCode: "PREVIEW_DAILY_SALES_UPLOAD_INIT_INVALID",
    idempotencyKey: randomUUID(),
    method: "POST",
  });
  const uploadId = initialized?.upload?.id;
  if (!uploadId || !initialized.uploadUrl)
    throw new Error("PREVIEW_DAILY_SALES_UPLOAD_INIT_RESPONSE_INVALID");
  const uploaded = await request(initialized.uploadUrl, {
    headers: {
      "content-length": String(png.length),
      "content-type": "image/png",
      "if-none-match": "*",
      origin: baseUrl,
      "sec-fetch-site": "same-origin",
    },
    method: "PUT",
    raw: true,
    rawBody: png,
  });
  const etag = uploaded.response.headers.get("etag");
  if (uploaded.response.status !== 204) {
    const statusClass =
      uploaded.response.status === 401
        ? "AUTHENTICATION"
        : uploaded.response.status === 404
          ? "NOT_FOUND"
          : uploaded.response.status === 409
            ? "CONFLICT"
            : uploaded.response.status === 422
              ? "VALIDATION"
              : "OTHER";
    throw new Error(`PREVIEW_DAILY_SALES_UPLOAD_BODY_STATUS_${statusClass}`);
  }
  if (!etag) throw new Error("PREVIEW_DAILY_SALES_UPLOAD_BODY_ETAG_MISSING");
  await api(`/api/files/uploads/${uploadId}/complete`, {
    body: { etag },
    failureCode: "PREVIEW_DAILY_SALES_UPLOAD_COMPLETE_INVALID",
    idempotencyKey: randomUUID(),
    method: "POST",
  });
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const status = await api(`/api/files/uploads/${uploadId}`, {
      failureCode: "PREVIEW_DAILY_SALES_UPLOAD_STATUS_INVALID",
    });
    if (
      ["READY_UNLINKED", "LINKED"].includes(status?.upload?.status) &&
      status.upload.fileVersionId
    )
      return status.upload.fileVersionId;
    if (["EXPIRED", "REJECTED", "SCAN_FAILED"].includes(status?.upload?.status))
      throw new Error("PREVIEW_DAILY_SALES_UPLOAD_SCAN_FAILED");
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error("PREVIEW_DAILY_SALES_UPLOAD_SCAN_TIMEOUT");
}
async function visible(locator, code) {
  try {
    await locator.waitFor({ state: "visible", timeout: 30_000 });
  } catch {
    throw new Error(code);
  }
}

try {
  const sessions =
    await sql`select * from public.auth_create_session_v2(${sessionId}::uuid, ${tokenHash}, ${bootstrapSubject}, 28800, 86400, statement_timestamp(), ${randomUUID()}::uuid)`;
  const principal = sessions[0];
  if (
    sessions.length !== 1 ||
    principal?.result_status !== "CREATED" ||
    principal?.user_type !== "INTERNAL_STAFF"
  )
    throw new Error("PREVIEW_DAILY_SALES_SESSION_FAILED");
  sessionCreated = true;
  failureStage = "HOTEL_SCOPE";
  const [scope] = await ownerSql`
    select assignment.branch_id from public.hotel_staff_assignments assignment
    join public.branches branch on branch.company_id=assignment.company_id and branch.id=assignment.branch_id
    join public.hotel_profiles hotel on hotel.company_id=assignment.company_id and hotel.branch_id=assignment.branch_id
    where assignment.company_id=${principal.company_id}::uuid and assignment.user_id=${principal.user_id}::uuid
      and assignment.terminated_at is null and assignment.start_date<=statement_timestamp()::date
      and (assignment.end_date is null or assignment.end_date>=statement_timestamp()::date)
      and branch.branch_type='HOTEL' and branch.status='ACTIVE' and hotel.hotel_status='ACTIVE'
    order by assignment.created_at,assignment.id limit 1`;
  hotelId = scope?.branch_id;
  if (!hotelId) throw new Error("PREVIEW_DAILY_SALES_HOTEL_UNAVAILABLE");
  failureStage = "GRANTS";
  for (const permissionCode of permissionCodes) {
    const [permission] = await ownerSql`
      select exists(
        select 1 from public.permissions where code=${permissionCode}
      ) as present
    `;
    if (!permission?.present)
      throw new Error(
        `PREVIEW_DAILY_SALES_GRANT_CATALOG_MISSING_${permissionCode}`,
      );
  }
  try {
    createdGrantIds = await ownerSql.begin(async (tx) => {
      const inserted = [];
      for (const permissionCode of permissionCodes) {
        const [existing] = await tx`
          select id
            from public.permission_grants
           where company_id=${principal.company_id}::uuid
             and branch_id=${hotelId}::uuid
             and subject_type='USER'
             and subject_id=${principal.user_id}::uuid
             and permission_code=${permissionCode}
             and effect='ALLOW'
             and valid_from<=statement_timestamp()
             and (valid_until is null or valid_until>statement_timestamp())
           order by valid_from desc,id
           limit 1
        `;
        if (existing) continue;
        const grantId = randomUUID();
        await tx`
          insert into public.permission_grants(
            id,company_id,branch_id,subject_type,subject_id,permission_code,
            effect,valid_from,granted_by,reason
          ) values(
            ${grantId}::uuid,${principal.company_id}::uuid,${hotelId}::uuid,
            'USER',${principal.user_id}::uuid,${permissionCode},'ALLOW',
            statement_timestamp()-interval '1 minute',${principal.user_id}::uuid,
            'Preview 일매출 canary 권한'
          )
        `;
        inserted.push(grantId);
      }
      return inserted;
    });
  } catch (error) {
    const sqlState =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    const classification = sqlState.startsWith("23")
      ? "CONSTRAINT"
      : sqlState.startsWith("42")
        ? "CONTRACT"
        : sqlState.startsWith("28")
          ? "AUTHORITY"
          : "UNKNOWN";
    throw new Error(`PREVIEW_DAILY_SALES_GRANTS_${classification}`);
  }
  grantsCreated = createdGrantIds.length > 0;
  const [dateRow] = await ownerSql`
    select candidate::date as business_date from generate_series(date '2090-01-01',date '2190-12-31',interval '1 day') candidate
    where not exists(select 1 from public.hotel_daily_sales sales where sales.company_id=${principal.company_id}::uuid and sales.branch_id=${hotelId}::uuid and sales.business_date=candidate::date)
    order by candidate limit 1`;
  const businessDate =
    dateRow?.business_date?.toISOString?.().slice(0, 10) ??
    String(dateRow?.business_date).slice(0, 10);
  if (!/^2[01]\d\d-\d\d-\d\d$/u.test(businessDate))
    throw new Error("PREVIEW_DAILY_SALES_DATE_UNAVAILABLE");
  let references = await api(`/api/hotels/${hotelId}/daily-sales/references`, {
    failureCode: "PREVIEW_DAILY_SALES_REFERENCES_INVALID",
  });
  const activeCategoryId = references?.categories?.[0]?.id;
  const activePaymentMethodId = references?.paymentMethods?.[0]?.id;
  if (!activeCategoryId || !activePaymentMethodId) {
    failureStage = "REFERENCE_FIXTURE";
    await ownerSql.begin(async (tx) => {
      if (!activeCategoryId) {
        await tx`
          insert into public.hotel_sales_categories(
            id,company_id,branch_id,name,status,display_order,created_by
          ) values(
            ${randomUUID()}::uuid,${principal.company_id}::uuid,${hotelId}::uuid,
            ${canaryCategoryName},'ACTIVE',2147483647,${principal.user_id}::uuid
          )
          on conflict (company_id,branch_id,name)
          do update set status='ACTIVE'
        `;
      }
      if (!activePaymentMethodId) {
        await tx`
          insert into public.hotel_payment_methods(
            id,company_id,branch_id,name,status,display_order,created_by
          ) values(
            ${randomUUID()}::uuid,${principal.company_id}::uuid,${hotelId}::uuid,
            ${canaryPaymentMethodName},'ACTIVE',2147483647,${principal.user_id}::uuid
          )
          on conflict (company_id,branch_id,name)
          do update set status='ACTIVE'
        `;
      }
    });
    references = await api(`/api/hotels/${hotelId}/daily-sales/references`, {
      failureCode: "PREVIEW_DAILY_SALES_REFERENCES_READBACK_INVALID",
    });
  }
  const categoryId =
    activeCategoryId ??
    references?.categories?.find((item) => item.name === canaryCategoryName)
      ?.id;
  const paymentMethodId =
    activePaymentMethodId ??
    references?.paymentMethods?.find(
      (item) => item.name === canaryPaymentMethodName,
    )?.id;
  if (!categoryId || !paymentMethodId)
    throw new Error("PREVIEW_DAILY_SALES_REFERENCES_EMPTY");
  failureStage = "API_DB";
  const salesId = randomUUID();
  const baseLine = {
    categoryId,
    paymentMethodId,
    grossAmount: 170000,
    discountAmount: 10000,
    refundAmount: 5000,
    refundReason: "Preview 환불 검증",
  };
  let sales = await command(
    `/api/hotels/${hotelId}/daily-sales`,
    "POST",
    { salesId, businessDate, memo: "Preview 일매출 canary", lines: [baseLine] },
    "PREVIEW_DAILY_SALES_CREATE_INVALID",
  );
  if (sales.status !== "DRAFT" || sales.totals?.netAmount !== 155000)
    throw new Error("PREVIEW_DAILY_SALES_CREATE_READBACK_INVALID");
  const list = await api(
    `/api/hotels/${hotelId}/daily-sales?page=1&pageSize=100`,
    { failureCode: "PREVIEW_DAILY_SALES_LIST_INVALID" },
  );
  if (!list?.sales?.some((item) => item.id === salesId))
    throw new Error("PREVIEW_DAILY_SALES_LIST_READBACK_INVALID");
  const closingFile = await uploadEvidence(salesId, "preview-closing-evidence");
  sales = await command(
    `/api/hotels/${hotelId}/daily-sales/${salesId}/confirm`,
    "POST",
    { version: sales.version, evidenceFileVersionIds: [closingFile] },
    "PREVIEW_DAILY_SALES_CONFIRM_INVALID",
  );
  if (sales.status !== "LOCKED" || sales.evidence?.length !== 1)
    throw new Error("PREVIEW_DAILY_SALES_CONFIRM_READBACK_INVALID");
  const correctionFile = await uploadEvidence(
    salesId,
    "preview-correction-evidence",
  );
  sales = await command(
    `/api/hotels/${hotelId}/daily-sales/${salesId}/corrections`,
    "POST",
    {
      version: sales.version,
      reason: "Preview 누락 금액 정정",
      evidenceFileVersionIds: [correctionFile],
      memo: "Preview 정정 완료",
      lines: [{ ...baseLine, grossAmount: 180000 }],
    },
    "PREVIEW_DAILY_SALES_CORRECT_INVALID",
  );
  if (sales.totals?.netAmount !== 165000 || sales.corrections?.length !== 1)
    throw new Error("PREVIEW_DAILY_SALES_CORRECT_READBACK_INVALID");
  const viewed = await request(
    `/api/hotels/${hotelId}/daily-sales/${salesId}/files/${correctionFile}/view`,
    {
      headers: { "sec-fetch-site": "same-origin" },
      raw: true,
    },
  );
  const viewedBody = Buffer.from(await viewed.response.arrayBuffer());
  if (
    viewed.response.status !== 200 ||
    viewed.response.headers.get("content-type") !== "image/png" ||
    viewed.response.headers.get("x-content-type-options") !== "nosniff" ||
    !viewedBody.equals(png)
  )
    throw new Error("PREVIEW_DAILY_SALES_EVIDENCE_VIEW_INVALID");
  const [readback] = await ownerSql`
    select sales.status,sales.net_amount,
      (select count(*)::int from public.hotel_daily_sales_versions v where v.company_id=sales.company_id and v.sales_id=sales.id) version_count,
      (select count(*)::int from public.hotel_daily_sales_attachments a where a.company_id=sales.company_id and a.sales_id=sales.id) attachment_count,
      exists(select 1 from public.audit_events a where a.company_id=sales.company_id and a.resource_id=sales.id and a.event_code='HOTEL_DAILY_SALES_CORRECT') corrected_audit
    from public.hotel_daily_sales sales where sales.company_id=${principal.company_id}::uuid and sales.id=${salesId}::uuid`;
  if (
    readback?.status !== "LOCKED" ||
    Number(readback.net_amount) !== 165000 ||
    readback.version_count !== 2 ||
    readback.attachment_count !== 2 ||
    !readback.corrected_audit
  )
    throw new Error("PREVIEW_DAILY_SALES_DATABASE_READBACK_INVALID");
  console.log("PREVIEW_DAILY_SALES_API_DB_SMOKE_OK");
  failureStage = "UI";
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
  const response = await page.goto(`${baseUrl}/hotels/${hotelId}/daily-sales`, {
    timeout: 120_000,
    waitUntil: "domcontentloaded",
  });
  if (
    !response?.ok() ||
    ["/login", "/account/initial-password"].includes(
      new URL(page.url()).pathname,
    )
  )
    throw new Error("PREVIEW_DAILY_SALES_UI_DOCUMENT_INVALID");
  await visible(
    page.locator("[data-daily-sales-workspace]"),
    "PREVIEW_DAILY_SALES_UI_WORKSPACE_MISSING",
  );
  await visible(
    page.getByText(businessDate).first(),
    "PREVIEW_DAILY_SALES_UI_DATE_MISSING",
  );
  await visible(
    page.getByText("165,000원").first(),
    "PREVIEW_DAILY_SALES_UI_TOTAL_MISSING",
  );
  await visible(
    page.getByRole("link", { name: /preview-correction-evidence\.png 보기/u }),
    "PREVIEW_DAILY_SALES_UI_EVIDENCE_LINK_MISSING",
  );
  if (
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
  )
    throw new Error("PREVIEW_DAILY_SALES_MOBILE_OVERFLOW");
  if (
    (
      await new AxeBuilder({ page })
        .include("[data-daily-sales-workspace]")
        .analyze()
    ).violations.length
  )
    throw new Error("PREVIEW_DAILY_SALES_AXE_FAILED");
  const nav = page.getByRole("link", { name: "일매출", exact: true });
  await visible(nav, "PREVIEW_DAILY_SALES_NAVIGATION_MISSING");
  await context.close();
  console.log("PREVIEW_DAILY_SALES_UI_SMOKE_OK");
} catch (error) {
  const code =
    error instanceof Error &&
    /^PREVIEW_DAILY_SALES_[A-Z_]+$/u.test(error.message)
      ? error.message
      : `PREVIEW_DAILY_SALES_FAILED_${failureStage}`;
  console.error(code);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => undefined);
  if (grantsCreated)
    await ownerSql`delete from public.permission_grants where id=any(${createdGrantIds}::uuid[])`.catch(
      () => {
        console.error("PREVIEW_DAILY_SALES_CLEANUP_GRANTS_FAILED");
        process.exitCode = 1;
      },
    );
  if (sessionCreated)
    await sql`select * from public.auth_revoke_session_v2(${tokenHash},'Preview 일매출 smoke cleanup',${randomUUID()}::uuid)`.catch(
      () => {
        console.error("PREVIEW_DAILY_SALES_CLEANUP_SESSION_FAILED");
        process.exitCode = 1;
      },
    );
  await ownerSql.end({ timeout: 5 }).catch(() => undefined);
  await sql.end({ timeout: 5 }).catch(() => undefined);
}
