import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
import { runFileScannerBatch } from "../apps/file-processor/src/batch.ts";
import { scanWithClamAv } from "../apps/file-processor/src/clamav.ts";
import { optimizeEvidenceImage } from "../apps/file-processor/src/image-processor.ts";
import { completeUploadWithReplay } from "./lib/inquiry-smoke-recovery.mjs";

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
const ownerDatabaseUrl = process.env.DATABASE_URL_PREVIEW?.trim();
const scannerAgentToken = process.env.PREVIEW_FILE_SCANNER_AGENT_TOKEN?.trim();
if (
  !baseUrl?.startsWith("https://") ||
  !bootstrapSubject ||
  !apiUrlFile ||
  !reconcilerUrlFile ||
  !ownerDatabaseUrl ||
  !scannerAgentToken ||
  scannerAgentToken.length < 32 ||
  scannerAgentToken.length > 256
)
  throw new Error("PREVIEW_OWNER_INQUIRY_CONFIGURATION_INVALID");

const sql = postgres((await readFile(apiUrlFile, "utf8")).trim(), {
  max: 1,
  prepare: false,
});
const reconcilerSql = postgres(
  (await readFile(reconcilerUrlFile, "utf8")).trim(),
  { max: 1, prepare: false },
);
const ownerSql = postgres(ownerDatabaseUrl, { max: 1, prepare: false });
function sessionCredential() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: createHash("sha256").update(token, "utf8").digest(),
    sessionId: randomUUID(),
  };
}
const internalCredential = sessionCredential();
let ownerACredential;
let ownerBCredential;
const canaryPhase = process.env.OWNER_INQUIRY_SMOKE_PHASE ?? "PRE_CONTRACT";
const releaseAttempt = [
  process.env.GITHUB_SHA,
  process.env.GITHUB_RUN_ID,
  process.env.GITHUB_RUN_ATTEMPT,
]
  .filter(Boolean)
  .join(":");
const canarySeed = `${releaseAttempt || process.env.OWNER_INQUIRY_CANARY_SEED || randomUUID()}:${canaryPhase}`;
function uuidFromSeed(seed, label) {
  const bytes = createHash("sha256")
    .update(`${seed}:${label}`, "utf8")
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function stableUuid(label) {
  return uuidFromSeed(canarySeed, label);
}
const internalPermissionCodes = [
  "HOTEL_INQUIRY_READ",
  "HOTEL_INQUIRY_REPLY",
  "HOTEL_INQUIRY_ASSIGN",
  "HOTEL_INQUIRY_SETTINGS",
];
const ownerPermissionCodes = [
  "HOTEL_OWNER_INQUIRY_READ",
  "HOTEL_OWNER_INQUIRY_CREATE",
];
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
let browser;
const createdSessionHashes = [];
let createdGrantIds = [];
let failureStage = "SESSION";
let hotelId;
let principal;
let inquiryId;
let canaryUploadId;
let canaryUploadUrl;
let canaryUploadEtag;
let canaryFileVersionId;

async function request(path, options = {}) {
  const headers = {
    accept: options.raw ? "*/*" : "application/json",
    cookie: `__Host-hotel_session=${options.sessionToken ?? internalCredential.token}`,
    ...(options.headers ?? {}),
  };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.idempotencyKey)
    headers["idempotency-key"] = options.idempotencyKey;
  const response = await fetch(
    path.startsWith("http") ? path : `${baseUrl}${path}`,
    {
      body:
        options.rawBody ??
        (options.body === undefined ? undefined : JSON.stringify(options.body)),
      headers,
      method: options.method ?? "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    },
  );
  return {
    payload: options.raw
      ? undefined
      : await response
          .clone()
          .json()
          .catch(() => undefined),
    response,
  };
}

async function api(path, options = {}) {
  const { payload, response } = await request(path, options);
  if (!response.ok || payload?.ok !== true || payload?.error !== null) {
    const safeCode = /^[A-Z_]+$/u.test(payload?.error?.code)
      ? payload.error.code
      : null;
    throw new Error(
      `${options.failureCode ?? "PREVIEW_OWNER_INQUIRY_API_INVALID"}${safeCode ? `_${safeCode}` : ""}`,
    );
  }
  return payload.data;
}

async function inquiryCommand(
  path,
  body,
  failureCode,
  sessionToken = internalCredential.token,
) {
  const data = await api(path, {
    body,
    failureCode,
    idempotencyKey: stableUuid(`command:${path}:${JSON.stringify(body)}`),
    method: "POST",
    sessionToken,
  });
  if (!data?.inquiry?.id || typeof data.inquiry.version !== "number")
    throw new Error(`${failureCode}_RESPONSE_INVALID`);
  return data.inquiry;
}

async function uploadAttachment(label, sessionToken) {
  const initialized = await api(`/api/hotels/${hotelId}/files/upload-init`, {
    body: {
      parent: { type: "OWNER_INQUIRY_ATTACHMENT", inquiryId },
      fileName: `${label}.png`,
      mimeType: "image/png",
      sizeBytes: png.length,
    },
    failureCode: "PREVIEW_OWNER_INQUIRY_UPLOAD_INIT_INVALID",
    idempotencyKey: stableUuid(`upload-init:${label}`),
    method: "POST",
    sessionToken,
  });
  const uploadId = initialized?.upload?.id;
  if (
    !uploadId ||
    !initialized.uploadUrl ||
    !initialized.uploadUrl.endsWith(`/body`)
  )
    throw new Error("PREVIEW_OWNER_INQUIRY_UPLOAD_INIT_RESPONSE_INVALID");
  canaryUploadId = uploadId;
  canaryUploadUrl = initialized.uploadUrl;
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
    sessionToken,
  });
  const etag = uploaded.response.headers.get("etag");
  if (uploaded.response.status !== 204 || !etag)
    throw new Error("PREVIEW_OWNER_INQUIRY_UPLOAD_BODY_INVALID");
  canaryUploadEtag = etag;
  const completeInput = {
    body: { etag },
    failureCode: "PREVIEW_OWNER_INQUIRY_UPLOAD_COMPLETE_INVALID",
    idempotencyKey: stableUuid(`upload-complete:${label}`),
    method: "POST",
    sessionToken,
  };
  const completion = await completeUploadWithReplay({
    complete: () =>
      api(`/api/files/uploads/${uploadId}/complete`, completeInput),
    readStatus: () =>
      api(
        `/api/files/uploads/${uploadId}?hotelId=${encodeURIComponent(hotelId)}`,
        {
          failureCode: "PREVIEW_OWNER_INQUIRY_UPLOAD_STATUS_INVALID",
          sessionToken,
        },
      ),
    sleep: () => new Promise((resolve) => setTimeout(resolve, 500)),
  });
  if (completion.state === "TERMINAL")
    throw new Error("PREVIEW_OWNER_INQUIRY_UPLOAD_SCAN_FAILED");
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await runFileScannerBatch({
      agentToken: scannerAgentToken,
      apiUrl: baseUrl,
      batchSize: 25,
      optimize: optimizeEvidenceImage,
      scan: (body) =>
        scanWithClamAv(body, {
          host: "127.0.0.1",
          port: 3310,
          timeoutMs: 30_000,
        }),
    });
    const status = await api(
      `/api/files/uploads/${uploadId}?hotelId=${encodeURIComponent(hotelId)}`,
      {
        failureCode: "PREVIEW_OWNER_INQUIRY_UPLOAD_STATUS_INVALID",
        sessionToken,
      },
    );
    if (
      ["READY_UNLINKED", "LINKED"].includes(status?.upload?.status) &&
      status.upload.fileVersionId
    ) {
      canaryFileVersionId = status.upload.fileVersionId;
      return canaryFileVersionId;
    }
    if (["EXPIRED", "REJECTED", "SCAN_FAILED"].includes(status?.upload?.status))
      throw new Error("PREVIEW_OWNER_INQUIRY_UPLOAD_SCAN_FAILED");
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error("PREVIEW_OWNER_INQUIRY_UPLOAD_SCAN_TIMEOUT");
}

function expectedContentDisposition(displayName) {
  const ascii = displayName
    .replace(/[^\x20-\x7e]/gu, "_")
    .replace(/["\\\r\n]/gu, "_")
    .slice(0, 120);
  const encoded = encodeURIComponent(displayName).replace(
    /[!'()*]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${ascii || "inspection-evidence"}"; filename*=UTF-8''${encoded}`;
}

async function requireVisible(locator, code) {
  try {
    await locator.waitFor({ state: "visible", timeout: 30_000 });
  } catch {
    throw new Error(code);
  }
}

async function verifyUi(viewport, suffix, title, sessionToken, expectInternal) {
  const context = await browser.newContext({ viewport });
  await context.addCookies([
    {
      httpOnly: true,
      name: "__Host-hotel_session",
      sameSite: "Lax",
      secure: true,
      url: baseUrl,
      value: sessionToken,
    },
  ]);
  const page = await context.newPage();
  const response = await page.goto(
    `${baseUrl}/hotels/${hotelId}/inquiries?inquiryId=${inquiryId}`,
    {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    },
  );
  if (!response?.ok() || new URL(page.url()).pathname === "/login")
    throw new Error(`PREVIEW_OWNER_INQUIRY_UI_DOCUMENT_${suffix}`);
  await page
    .locator('[data-inquiry-workspace], section[role="alert"]')
    .first()
    .waitFor({
      state: "visible",
      timeout: 30_000,
    })
    .catch(() => undefined);
  if (!(await page.locator("[data-inquiry-workspace]").count())) {
    const errorStage = await page
      .locator('section[role="alert"][data-error-stage]')
      .first()
      .getAttribute("data-error-stage");
    if (
      [
        "LIST_REQUEST",
        "LIST_PARSE",
        "SETTINGS",
        "DETAIL_REQUEST",
        "DETAIL_RESPONSE",
      ].includes(errorStage)
    ) {
      const errorElement = page
        .locator('section[role="alert"][data-error-stage]')
        .first();
      const errorCode = await errorElement.getAttribute("data-error-code");
      const errorStatus = await errorElement.getAttribute("data-error-status");
      const safeErrorCode = /^[A-Z][A-Z0-9_]{0,63}$/u.test(errorCode ?? "")
        ? errorCode
        : "INVALID_CODE";
      const safeStatus = /^(?:4\d\d|5\d\d)$/u.test(errorStatus ?? "")
        ? errorStatus
        : "INVALID_STATUS";
      throw new Error(
        `PREVIEW_OWNER_INQUIRY_UI_SERVER_${errorStage}_${safeStatus}_${safeErrorCode}_${suffix}`,
      );
    }
    const safeErrors = new Map([
      ["문의 응답을 안전하게 확인하지 못했습니다.", "LIST_OR_CAPABILITIES"],
      ["문의 설정을 안전하게 확인하지 못했습니다.", "SETTINGS"],
      ["문의 상세를 불러오지 못했습니다.", "DETAIL_REQUEST"],
      ["문의 상세 응답을 확인하지 못했습니다.", "DETAIL_RESPONSE"],
    ]);
    for (const [message, code] of safeErrors)
      if (
        await page
          .getByText(message, { exact: true })
          .isVisible()
          .catch(() => false)
      )
        throw new Error(`PREVIEW_OWNER_INQUIRY_UI_SERVER_${code}_${suffix}`);
    if (
      await page
        .getByRole("heading", { name: "호텔 화면을 불러오지 못했습니다" })
        .isVisible()
        .catch(() => false)
    ) {
      await page.goto(`${baseUrl}/hotels`, {
        timeout: 120_000,
        waitUntil: "domcontentloaded",
      });
      const layoutFailed = await page
        .getByRole("heading", { name: "호텔 화면을 불러오지 못했습니다" })
        .isVisible()
        .catch(() => false);
      throw new Error(
        `PREVIEW_OWNER_INQUIRY_UI_GLOBAL_${layoutFailed ? "LAYOUT" : "INQUIRY_ROUTE"}_${suffix}`,
      );
    }
  }
  await requireVisible(
    page.locator("[data-inquiry-workspace]"),
    `PREVIEW_OWNER_INQUIRY_UI_WORKSPACE_${suffix}`,
  );
  await requireVisible(
    page.getByRole("heading", { name: "호텔 소유주 문의" }),
    `PREVIEW_OWNER_INQUIRY_UI_HEADING_${suffix}`,
  );
  await requireVisible(
    page.getByText(title).first(),
    `PREVIEW_OWNER_INQUIRY_UI_TITLE_${suffix}`,
  );
  await requireVisible(
    page.getByText("Preview 공개 답변"),
    `PREVIEW_OWNER_INQUIRY_UI_PUBLIC_MESSAGE_${suffix}`,
  );
  if (expectInternal)
    await requireVisible(
      page.getByText("Preview 내부 검토"),
      `PREVIEW_OWNER_INQUIRY_UI_INTERNAL_MESSAGE_${suffix}`,
    );
  else if (await page.getByText("Preview 내부 검토").count())
    throw new Error(`PREVIEW_OWNER_INQUIRY_UI_INTERNAL_LEAK_${suffix}`);
  await requireVisible(
    page.getByRole("heading", { name: "문의 알림" }),
    `PREVIEW_OWNER_INQUIRY_UI_NOTIFICATION_${suffix}`,
  );
  const commonNotificationTrigger = page.getByRole("button", {
    name: /알림 .*목록 열기|새 알림 없음, 목록 열기/u,
  });
  await requireVisible(
    commonNotificationTrigger,
    `PREVIEW_OWNER_INQUIRY_UI_COMMON_NOTIFICATION_TRIGGER_${suffix}`,
  );
  await commonNotificationTrigger.click();
  const commonNotificationDialog = page.getByRole("dialog", { name: "알림" });
  await requireVisible(
    commonNotificationDialog,
    `PREVIEW_OWNER_INQUIRY_UI_COMMON_NOTIFICATION_DIALOG_${suffix}`,
  );
  const commonTarget = commonNotificationDialog
    .locator(`a[href="/hotels/${hotelId}/inquiries?inquiryId=${inquiryId}"]`)
    .first();
  await requireVisible(
    commonTarget,
    `PREVIEW_OWNER_INQUIRY_UI_COMMON_NOTIFICATION_TARGET_${suffix}`,
  );
  const notificationAxe = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .analyze();
  if (notificationAxe.violations.length) {
    const ruleIds = notificationAxe.violations
      .map((violation) =>
        violation.id.toUpperCase().replace(/[^A-Z0-9]+/gu, "_"),
      )
      .sort()
      .join("_");
    throw new Error(
      `PREVIEW_OWNER_INQUIRY_UI_COMMON_NOTIFICATION_AXE_${suffix}_${ruleIds}`,
    );
  }
  await page.getByRole("button", { name: "알림 목록 닫기" }).click();
  const attachmentLink = page
    .getByRole("link", { name: "Preview 문의 첨부.png" })
    .first();
  await requireVisible(
    attachmentLink,
    `PREVIEW_OWNER_INQUIRY_UI_ATTACHMENT_${suffix}`,
  );
  const attachmentHref = await attachmentLink.getAttribute("href");
  if (
    !attachmentHref ||
    !attachmentHref.startsWith(
      `/api/hotels/${hotelId}/inquiries/${inquiryId}/files/`,
    )
  )
    throw new Error(`PREVIEW_OWNER_INQUIRY_UI_ATTACHMENT_URL_${suffix}`);
  const attachmentStatus = await page.evaluate(
    async (href) =>
      (await fetch(href, { headers: { "sec-fetch-site": "same-origin" } }))
        .status,
    attachmentHref,
  );
  if (attachmentStatus !== 200)
    throw new Error(`PREVIEW_OWNER_INQUIRY_UI_ATTACHMENT_REQUEST_${suffix}`);
  if (
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
  )
    throw new Error(`PREVIEW_OWNER_INQUIRY_UI_OVERFLOW_${suffix}`);
  const axeResult = await new AxeBuilder({ page })
    .include("[data-inquiry-workspace]")
    .analyze();
  if (axeResult.violations.length) {
    const ruleIds = axeResult.violations
      .map((violation) =>
        violation.id.toUpperCase().replace(/[^A-Z0-9]+/gu, "_"),
      )
      .sort()
      .join("_");
    throw new Error(`PREVIEW_OWNER_INQUIRY_UI_AXE_${suffix}_${ruleIds}`);
  }
  await context.close();
}

async function terminalizeFailedCanary() {
  if (!inquiryId || !hotelId || !principal || !ownerACredential) return;
  const [createdInquiry] = await ownerSql`
    select exists(select 1 from public.hotel_inquiries
      where company_id=${principal.company_id}::uuid and branch_id=${hotelId}::uuid and id=${inquiryId}::uuid) as present
  `;
  if (!createdInquiry?.present) return;

  if (canaryUploadId && canaryUploadUrl && !canaryUploadEtag) {
    const replay = await request(canaryUploadUrl, {
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
      sessionToken: ownerACredential.token,
    });
    if (replay.response.status === 204)
      canaryUploadEtag = replay.response.headers.get("etag");
  }
  if (canaryUploadId && canaryUploadEtag) {
    await api(`/api/files/uploads/${canaryUploadId}/complete`, {
      body: { etag: canaryUploadEtag },
      failureCode: "PREVIEW_OWNER_INQUIRY_CLEANUP_COMPLETE_INVALID",
      idempotencyKey: stableUuid("cleanup-upload-complete"),
      method: "POST",
      sessionToken: ownerACredential.token,
    }).catch(() => undefined);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await runFileScannerBatch({
        agentToken: scannerAgentToken,
        apiUrl: baseUrl,
        batchSize: 25,
        optimize: optimizeEvidenceImage,
        scan: (body) =>
          scanWithClamAv(body, {
            host: "127.0.0.1",
            port: 3310,
            timeoutMs: 30_000,
          }),
      });
      const [upload] = await ownerSql`
        select status,file_version_id from public.hotel_file_uploads
         where company_id=${principal.company_id}::uuid and branch_id=${hotelId}::uuid and id=${canaryUploadId}::uuid
      `;
      if (
        [
          "READY_UNLINKED",
          "LINKED",
          "EXPIRED",
          "REJECTED",
          "SCAN_FAILED",
        ].includes(upload?.status)
      ) {
        canaryFileVersionId = upload.file_version_id ?? canaryFileVersionId;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  let detail = await api(`/api/hotels/${hotelId}/inquiries/${inquiryId}`, {
    failureCode: "PREVIEW_OWNER_INQUIRY_CLEANUP_READ_INVALID",
    sessionToken: ownerACredential.token,
  });
  let current = detail.inquiry;
  const [attachment] = canaryFileVersionId
    ? await ownerSql`
        select exists(select 1 from public.hotel_inquiry_message_attachments
          where company_id=${principal.company_id}::uuid and branch_id=${hotelId}::uuid
            and inquiry_id=${inquiryId}::uuid and file_version_id=${canaryFileVersionId}::uuid) as linked
      `
    : [{ linked: true }];
  if (canaryFileVersionId && !attachment?.linked && current.status !== "CLOSED")
    current = await inquiryCommand(
      `/api/hotels/${hotelId}/inquiries/${inquiryId}/messages`,
      {
        version: current.version,
        body: "Preview 실패 canary 첨부 terminalization",
        visibility: "PUBLIC",
        attachmentFileVersionIds: [canaryFileVersionId],
      },
      "PREVIEW_OWNER_INQUIRY_CLEANUP_LINK_INVALID",
      ownerACredential.token,
    );
  if (current.status === "RECEIVED")
    current = await inquiryCommand(
      `/api/hotels/${hotelId}/inquiries/${inquiryId}/assign`,
      {
        version: current.version,
        assigneeUserId: principal.user_id,
        reason: "Preview 실패 canary terminalization",
      },
      "PREVIEW_OWNER_INQUIRY_CLEANUP_ASSIGN_INVALID",
    );
  if (["ASSIGNED", "SUPPLEMENT_REQUESTED"].includes(current.status))
    current = await inquiryCommand(
      `/api/hotels/${hotelId}/inquiries/${inquiryId}/transitions`,
      {
        version: current.version,
        action: "START_ANSWER",
        reason: "Preview 실패 canary terminalization",
      },
      "PREVIEW_OWNER_INQUIRY_CLEANUP_START_INVALID",
    );
  if (current.status === "ANSWERING") {
    current = await inquiryCommand(
      `/api/hotels/${hotelId}/inquiries/${inquiryId}/messages`,
      {
        version: current.version,
        body: "Preview 실패 canary 종료",
        visibility: "PUBLIC",
        attachmentFileVersionIds: [],
      },
      "PREVIEW_OWNER_INQUIRY_CLEANUP_MESSAGE_INVALID",
    );
    current = await inquiryCommand(
      `/api/hotels/${hotelId}/inquiries/${inquiryId}/transitions`,
      {
        version: current.version,
        action: "MARK_ANSWERED",
        reason: "Preview 실패 canary terminalization",
      },
      "PREVIEW_OWNER_INQUIRY_CLEANUP_ANSWER_INVALID",
    );
  }
  if (current.status === "ANSWERED")
    current = await inquiryCommand(
      `/api/hotels/${hotelId}/inquiries/${inquiryId}/transitions`,
      {
        version: current.version,
        action: "CLOSE",
        reason: "Preview 실패 canary terminalization",
      },
      "PREVIEW_OWNER_INQUIRY_CLEANUP_CLOSE_INVALID",
      ownerACredential.token,
    );

  await ownerSql`
    update public.hotel_file_access_grants set status='ABORTED',completed_at=statement_timestamp()
     where company_id=${principal.company_id}::uuid and branch_id=${hotelId}::uuid
       and inquiry_id=${inquiryId}::uuid and status='STARTED'
  `;
  const [terminal] = await ownerSql`
    select inquiry.status,
      (select count(*)::int from public.hotel_file_uploads upload
        where upload.company_id=inquiry.company_id and upload.branch_id=inquiry.branch_id and upload.inquiry_id=inquiry.id
          and upload.status not in('LINKED','EXPIRED','REJECTED','SCAN_FAILED')) as transient_uploads,
      (select count(*)::int from public.hotel_file_scan_jobs job join public.hotel_file_uploads upload on upload.company_id=job.company_id and upload.id=job.upload_id
        where upload.company_id=inquiry.company_id and upload.inquiry_id=inquiry.id and job.status not in('COMPLETED','FAILED','EXPIRED')) as transient_scans,
      (select count(*)::int from public.hotel_file_access_grants grant_row
        where grant_row.company_id=inquiry.company_id and grant_row.inquiry_id=inquiry.id and grant_row.status='STARTED') as open_grants
      from public.hotel_inquiries inquiry
     where inquiry.company_id=${principal.company_id}::uuid and inquiry.branch_id=${hotelId}::uuid and inquiry.id=${inquiryId}::uuid
  `;
  if (
    terminal?.status !== "CLOSED" ||
    terminal.transient_uploads !== 0 ||
    terminal.transient_scans !== 0 ||
    terminal.open_grants !== 0
  )
    throw new Error("PREVIEW_OWNER_INQUIRY_CLEANUP_READBACK_INVALID");
}

try {
  failureStage = "SESSION";
  const sessions = await sql`
    select * from public.auth_create_session_v2(
      ${internalCredential.sessionId}::uuid,${internalCredential.tokenHash},${bootstrapSubject},28800,86400,
      statement_timestamp(),${randomUUID()}::uuid
    )
  `;
  principal = sessions[0];
  if (
    sessions.length !== 1 ||
    principal?.result_status !== "CREATED" ||
    principal?.user_type !== "INTERNAL_STAFF"
  )
    throw new Error("PREVIEW_OWNER_INQUIRY_SESSION_FAILED");
  createdSessionHashes.push(internalCredential.tokenHash);

  failureStage = "HOTEL_SCOPE";
  const [scopeResult] = await sql.begin(async (tx) => {
    await tx`select set_config('app.session_id',${internalCredential.sessionId}::text,true)`;
    return tx`
      select * from public.hotel_inquiry_capabilities_v1(
        ${principal.company_id}::uuid,
        ${internalCredential.token}
      )
    `;
  });
  if (
    scopeResult?.command_status !== "OK" ||
    !Array.isArray(scopeResult?.result_snapshot?.hotels)
  )
    throw new Error(
      "PREVIEW_OWNER_INQUIRY_SCOPE_CAPABILITIES_RESPONSE_INVALID",
    );
  const scopeCapabilities = scopeResult.result_snapshot;
  const scope = scopeCapabilities.hotels.find(
    (candidate) =>
      candidate?.ownerView === false &&
      typeof candidate.hotelId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        candidate.hotelId,
      ),
  );
  hotelId = scope?.hotelId;
  if (!hotelId) throw new Error("PREVIEW_OWNER_INQUIRY_HOTEL_UNAVAILABLE");
  const loadOwnerCandidates = () => ownerSql`
    with target_owner as(
      select distinct on(assignment.user_id) assignment.user_id,identity.provider_subject,0 as priority
        from public.hotel_owner_assignments assignment
        join public.users owner_user on owner_user.company_id=assignment.company_id and owner_user.id=assignment.user_id and owner_user.user_type='HOTEL_OWNER' and owner_user.status='ACTIVE'
        join public.auth_identities identity on identity.company_id=assignment.company_id and identity.user_id=assignment.user_id and identity.provider='ZITADEL'
       where assignment.company_id=${principal.company_id}::uuid and assignment.branch_id=${hotelId}::uuid
         and assignment.terminated_at is null and assignment.start_date<=statement_timestamp()::date
         and(assignment.end_date is null or assignment.end_date>=statement_timestamp()::date)
       order by assignment.user_id,assignment.created_at
    ), other_owner as(
      select distinct on(assignment.user_id) assignment.user_id,identity.provider_subject,1 as priority
        from public.hotel_owner_assignments assignment
        join public.users owner_user on owner_user.company_id=assignment.company_id and owner_user.id=assignment.user_id and owner_user.user_type='HOTEL_OWNER' and owner_user.status='ACTIVE'
        join public.auth_identities identity on identity.company_id=assignment.company_id and identity.user_id=assignment.user_id and identity.provider='ZITADEL'
       where assignment.company_id=${principal.company_id}::uuid and assignment.branch_id<>${hotelId}::uuid
         and assignment.terminated_at is null and assignment.start_date<=statement_timestamp()::date
         and(assignment.end_date is null or assignment.end_date>=statement_timestamp()::date)
         and not exists(select 1 from target_owner target where target.user_id=assignment.user_id)
       order by assignment.user_id,assignment.created_at
    ) select user_id,provider_subject,priority from(select*from target_owner union all select*from other_owner)candidates order by priority,user_id limit 2
  `;
  const ensureOwnerFixture = async (label, assignToTarget) => {
    const ownerFixtureSeed = `preview-inquiry-owner:${principal.company_id}:${hotelId}:${label}`;
    const fixture = {
      assignmentId: uuidFromSeed(ownerFixtureSeed, "assignment"),
      identityId: uuidFromSeed(ownerFixtureSeed, "identity"),
      providerSubject: `preview-inquiry-owner-${createHash("sha256").update(ownerFixtureSeed).digest("hex").slice(0, 24)}`,
      userId: uuidFromSeed(ownerFixtureSeed, "user"),
    };
    await ownerSql.begin(async (tx) => {
      await tx`
        insert into public.users(id,company_id,user_type,display_name)
        values(${fixture.userId}::uuid,${principal.company_id}::uuid,'HOTEL_OWNER',${assignToTarget ? "Preview 문의 소유주 검증자" : "Preview 문의 격리 검증자"})
        on conflict(id)do nothing
      `;
      await tx`
        insert into public.auth_identities(id,company_id,user_id,provider,provider_subject)
        values(${fixture.identityId}::uuid,${principal.company_id}::uuid,${fixture.userId}::uuid,'ZITADEL',${fixture.providerSubject})
        on conflict(id)do nothing
      `;
      if (assignToTarget)
        await tx`
        insert into public.hotel_owner_assignments(id,company_id,branch_id,user_id,start_date,reason,created_by)
        values(${fixture.assignmentId}::uuid,${principal.company_id}::uuid,${hotelId}::uuid,${fixture.userId}::uuid,statement_timestamp()::date,'Preview 문의 owner canary',${principal.user_id}::uuid)
        on conflict(id)do nothing
      `;
    });
    const [readback] = await ownerSql`
      select owner_user.user_type,owner_user.status,identity.provider,identity.provider_subject,
             exists(select 1 from public.hotel_owner_assignments assignment
               where assignment.company_id=owner_user.company_id and assignment.user_id=owner_user.id
                 and assignment.branch_id=${hotelId}::uuid and assignment.terminated_at is null
                 and assignment.start_date<=statement_timestamp()::date
                 and(assignment.end_date is null or assignment.end_date>=statement_timestamp()::date))as target_owner,
             exists(select 1 from public.hotel_owner_assignments assignment
               where assignment.company_id=owner_user.company_id and assignment.user_id=owner_user.id
                 and assignment.terminated_at is null and assignment.start_date<=statement_timestamp()::date
                 and(assignment.end_date is null or assignment.end_date>=statement_timestamp()::date))as any_active_owner
        from public.users owner_user
        join public.auth_identities identity on identity.company_id=owner_user.company_id and identity.user_id=owner_user.id and identity.id=${fixture.identityId}::uuid
       where owner_user.company_id=${principal.company_id}::uuid and owner_user.id=${fixture.userId}::uuid
    `;
    if (
      readback?.user_type !== "HOTEL_OWNER" ||
      readback?.status !== "ACTIVE" ||
      readback?.provider !== "ZITADEL" ||
      readback?.provider_subject !== fixture.providerSubject ||
      readback?.target_owner !== assignToTarget ||
      (!assignToTarget && readback?.any_active_owner !== false)
    )
      throw new Error("PREVIEW_OWNER_INQUIRY_OWNER_FIXTURE_INVALID");
    return {
      priority: assignToTarget ? 0 : 1,
      provider_subject: fixture.providerSubject,
      user_id: fixture.userId,
    };
  };
  const discoveredOwners = await loadOwnerCandidates();
  const ownerA =
    discoveredOwners.find((candidate) => candidate.priority === 0) ??
    (await ensureOwnerFixture("target", true));
  const ownerB =
    discoveredOwners.find(
      (candidate) =>
        candidate.priority === 0 && candidate.user_id !== ownerA.user_id,
    ) ?? (await ensureOwnerFixture("isolated", true));
  const ownerCandidates = [ownerA, ownerB];
  if (ownerCandidates.length !== 2)
    throw new Error("PREVIEW_OWNER_INQUIRY_TWO_OWNERS_REQUIRED");
  ownerACredential = sessionCredential();
  ownerBCredential = sessionCredential();
  const ownerPrincipals = [];
  for (const [candidate, credential] of [
    [ownerCandidates[0], ownerACredential],
    [ownerCandidates[1], ownerBCredential],
  ]) {
    const rows =
      await sql`select * from public.auth_create_session_v2(${credential.sessionId}::uuid,${credential.tokenHash},${candidate.provider_subject},28800,86400,statement_timestamp(),${randomUUID()}::uuid)`;
    if (
      rows.length !== 1 ||
      rows[0]?.result_status !== "CREATED" ||
      rows[0]?.user_type !== "HOTEL_OWNER"
    )
      throw new Error("PREVIEW_OWNER_INQUIRY_OWNER_SESSION_FAILED");
    ownerPrincipals.push(rows[0]);
    createdSessionHashes.push(credential.tokenHash);
  }
  const [ownerAPrincipal, ownerBPrincipal] = ownerPrincipals;

  failureStage = "GRANTS";
  for (const permissionCode of [
    ...internalPermissionCodes,
    ...ownerPermissionCodes,
  ]) {
    const [permission] =
      await ownerSql`select exists(select 1 from public.permissions where code=${permissionCode}) as present`;
    if (!permission?.present)
      throw new Error(
        `PREVIEW_OWNER_INQUIRY_PERMISSION_MISSING_${permissionCode}`,
      );
  }
  createdGrantIds = await ownerSql.begin(async (tx) => {
    const inserted = [];
    for (const [subjectUserId, permissionCodes] of [
      [principal.user_id, internalPermissionCodes],
      [ownerAPrincipal.user_id, ownerPermissionCodes],
      [ownerBPrincipal.user_id, ownerPermissionCodes],
    ]) {
      for (const permissionCode of permissionCodes) {
        const [existing] =
          await tx`select id from public.permission_grants where company_id=${principal.company_id}::uuid and branch_id=${hotelId}::uuid and subject_type='USER' and subject_id=${subjectUserId}::uuid and permission_code=${permissionCode} and effect='ALLOW' and valid_from<=statement_timestamp() and(valid_until is null or valid_until>statement_timestamp())order by valid_from desc,id limit 1`;
        if (existing) continue;
        const grantId = randomUUID();
        await tx`insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason)values(${grantId}::uuid,${principal.company_id}::uuid,${hotelId}::uuid,'USER',${subjectUserId}::uuid,${permissionCode},'ALLOW',statement_timestamp()-interval '1 minute',${principal.user_id}::uuid,'Preview 소유주 문의 canary 권한')`;
        inserted.push(grantId);
      }
    }
    return inserted;
  });

  failureStage = "OWNER_CAPABILITIES";
  const capabilities = await api("/api/inquiries/capabilities", {
    failureCode: "PREVIEW_OWNER_INQUIRY_CAPABILITIES_INVALID",
    sessionToken: ownerACredential.token,
  });
  const targetCapability = capabilities?.hotels?.find(
    (candidate) => candidate.hotelId === hotelId,
  );
  if (!targetCapability?.ownerView || !targetCapability.canCreate)
    throw new Error("PREVIEW_OWNER_INQUIRY_OWNER_CAPABILITY_NOT_READY");
  const ownerBCapabilities = await api("/api/inquiries/capabilities", {
    failureCode: "PREVIEW_OWNER_INQUIRY_ISOLATION_CAPABILITY_INVALID",
    sessionToken: ownerBCredential.token,
  });
  if (
    !ownerBCapabilities?.hotels?.some(
      (candidate) => candidate.hotelId === hotelId && candidate.ownerView,
    )
  )
    throw new Error("PREVIEW_OWNER_INQUIRY_ISOLATION_CAPABILITY_INVALID");

  failureStage = "API_DB";
  inquiryId = stableUuid("inquiry");
  const title = `Preview 소유주 문의 canary ${canarySeed.slice(0, 12)}`;
  let inquiry = await inquiryCommand(
    `/api/hotels/${hotelId}/inquiries`,
    {
      inquiryId,
      categoryCode: "OTHER",
      title,
      body: "Hosted Preview 문의 접수·저장 검증",
    },
    "PREVIEW_OWNER_INQUIRY_CREATE_INVALID",
    ownerACredential.token,
  );
  const ownerBDenied = await request(
    `/api/hotels/${hotelId}/inquiries/${inquiryId}`,
    { sessionToken: ownerBCredential.token },
  );
  if (ownerBDenied.response.status !== 403 || ownerBDenied.payload?.data)
    throw new Error("PREVIEW_OWNER_INQUIRY_CROSS_OWNER_DETAIL_LEAK");
  const fileVersionId = await uploadAttachment(
    "Preview 문의 첨부",
    ownerACredential.token,
  );
  inquiry = await inquiryCommand(
    `/api/hotels/${hotelId}/inquiries/${inquiryId}/messages`,
    {
      version: inquiry.version,
      body: "Preview 첨부 자료",
      visibility: "PUBLIC",
      attachmentFileVersionIds: [fileVersionId],
    },
    "PREVIEW_OWNER_INQUIRY_ATTACHMENT_MESSAGE_INVALID",
    ownerACredential.token,
  );
  const ownerBList = await request(
    `/api/hotels/${hotelId}/inquiries?page=1&pageSize=100`,
    {
      sessionToken: ownerBCredential.token,
    },
  );
  if (
    !ownerBList.response.ok ||
    ownerBList.payload?.ok !== true ||
    ownerBList.payload?.data?.inquiries?.some(
      (candidate) => candidate.id === inquiryId,
    )
  )
    throw new Error("PREVIEW_OWNER_INQUIRY_CROSS_OWNER_LIST_LEAK");
  const ownerBTransition = await request(
    `/api/hotels/${hotelId}/inquiries/${inquiryId}/transitions`,
    {
      body: {
        version: inquiry.version,
        action: "CLOSE",
        reason: "교차 소유주 차단",
      },
      idempotencyKey: randomUUID(),
      method: "POST",
      sessionToken: ownerBCredential.token,
    },
  );
  if (
    ownerBTransition.response.status !== 403 ||
    ownerBTransition.payload?.data
  )
    throw new Error("PREVIEW_OWNER_INQUIRY_CROSS_OWNER_TRANSITION_LEAK");
  const ownerBUpload = await request(
    `/api/hotels/${hotelId}/files/upload-init`,
    {
      body: {
        parent: { type: "OWNER_INQUIRY_ATTACHMENT", inquiryId },
        fileName: "blocked.png",
        mimeType: "image/png",
        sizeBytes: png.length,
      },
      idempotencyKey: randomUUID(),
      method: "POST",
      sessionToken: ownerBCredential.token,
    },
  );
  if (ownerBUpload.response.status !== 404 || ownerBUpload.payload?.data)
    throw new Error("PREVIEW_OWNER_INQUIRY_CROSS_OWNER_UPLOAD_LEAK");
  inquiry = await inquiryCommand(
    `/api/hotels/${hotelId}/inquiries/${inquiryId}/assign`,
    {
      version: inquiry.version,
      assigneeUserId: principal.user_id,
      reason: "Preview canary 담당 지정",
    },
    "PREVIEW_OWNER_INQUIRY_ASSIGN_INVALID",
  );
  inquiry = await inquiryCommand(
    `/api/hotels/${hotelId}/inquiries/${inquiryId}/transitions`,
    {
      version: inquiry.version,
      action: "START_ANSWER",
      reason: "Preview 답변 시작",
    },
    "PREVIEW_OWNER_INQUIRY_START_INVALID",
  );
  inquiry = await inquiryCommand(
    `/api/hotels/${hotelId}/inquiries/${inquiryId}/messages`,
    {
      version: inquiry.version,
      body: "Preview 내부 검토",
      visibility: "INTERNAL",
      attachmentFileVersionIds: [],
    },
    "PREVIEW_OWNER_INQUIRY_INTERNAL_MESSAGE_INVALID",
  );
  inquiry = await inquiryCommand(
    `/api/hotels/${hotelId}/inquiries/${inquiryId}/messages`,
    {
      version: inquiry.version,
      body: "Preview 공개 답변",
      visibility: "PUBLIC",
      attachmentFileVersionIds: [],
    },
    "PREVIEW_OWNER_INQUIRY_PUBLIC_MESSAGE_INVALID",
  );
  inquiry = await inquiryCommand(
    `/api/hotels/${hotelId}/inquiries/${inquiryId}/transitions`,
    {
      version: inquiry.version,
      action: "MARK_ANSWERED",
      reason: "Preview 답변 완료",
    },
    "PREVIEW_OWNER_INQUIRY_ANSWER_INVALID",
  );
  if (inquiry.status !== "ANSWERED")
    throw new Error("PREVIEW_OWNER_INQUIRY_ANSWER_READBACK_INVALID");
  inquiry = await inquiryCommand(
    `/api/hotels/${hotelId}/inquiries/${inquiryId}/transitions`,
    {
      version: inquiry.version,
      action: "REQUEST_SUPPLEMENT",
      reason: "Preview 보완요청",
    },
    "PREVIEW_OWNER_INQUIRY_SUPPLEMENT_INVALID",
    ownerACredential.token,
  );
  inquiry = await inquiryCommand(
    `/api/hotels/${hotelId}/inquiries/${inquiryId}/transitions`,
    {
      version: inquiry.version,
      action: "START_ANSWER",
      reason: "Preview 재답변 시작",
    },
    "PREVIEW_OWNER_INQUIRY_REANSWER_START_INVALID",
  );
  inquiry = await inquiryCommand(
    `/api/hotels/${hotelId}/inquiries/${inquiryId}/messages`,
    {
      version: inquiry.version,
      body: "Preview 공개 재답변",
      visibility: "PUBLIC",
      attachmentFileVersionIds: [],
    },
    "PREVIEW_OWNER_INQUIRY_REANSWER_MESSAGE_INVALID",
  );
  inquiry = await inquiryCommand(
    `/api/hotels/${hotelId}/inquiries/${inquiryId}/transitions`,
    {
      version: inquiry.version,
      action: "MARK_ANSWERED",
      reason: "Preview 재답변 완료",
    },
    "PREVIEW_OWNER_INQUIRY_REANSWER_INVALID",
  );

  await ownerSql`
    update public.hotel_inquiries set answered_at=statement_timestamp()-interval '8 days'
     where company_id=${principal.company_id}::uuid and branch_id=${hotelId}::uuid and id=${inquiryId}::uuid
  `;
  await reconcilerSql`select * from public.hotel_inquiry_auto_close_v1(1000)`;
  const list = await api(
    `/api/hotels/${hotelId}/inquiries?page=1&pageSize=100`,
    {
      failureCode: "PREVIEW_OWNER_INQUIRY_LIST_INVALID",
      sessionToken: ownerACredential.token,
    },
  );
  if (
    !list?.inquiries?.some(
      (candidate) =>
        candidate.id === inquiryId && candidate.status === "CLOSED",
    )
  )
    throw new Error("PREVIEW_OWNER_INQUIRY_LIST_READBACK_INVALID");
  if (
    !list?.notifications?.some(
      (notification) =>
        notification.inquiryId === inquiryId &&
        notification.eventCode === "HOTEL_INQUIRY_AUTO_CLOSE",
    )
  )
    throw new Error("PREVIEW_OWNER_INQUIRY_NOTIFICATION_READBACK_INVALID");

  const commonNotificationsBeforeRead = await api(
    "/api/notifications?limit=20",
    {
      failureCode: "PREVIEW_OWNER_INQUIRY_COMMON_NOTIFICATION_LIST_INVALID",
      sessionToken: ownerACredential.token,
    },
  );
  const commonNotification = commonNotificationsBeforeRead?.notifications?.find(
    (notification) =>
      notification.source === "INQUIRY" &&
      notification.eventCode === "HOTEL_INQUIRY_AUTO_CLOSE" &&
      notification.href ===
        `/hotels/${hotelId}/inquiries?inquiryId=${inquiryId}`,
  );
  if (
    !commonNotification ||
    commonNotification.readAt !== null ||
    commonNotification.version !== 0
  )
    throw new Error(
      "PREVIEW_OWNER_INQUIRY_COMMON_NOTIFICATION_PROJECTION_INVALID",
    );
  const commonUnreadBefore = commonNotificationsBeforeRead.unreadCount;
  const commonReadKey = stableUuid("common-notification-read");
  const markCommonRead = () =>
    api(`/api/notifications/${commonNotification.id}/read`, {
      body: { version: 0 },
      failureCode: "PREVIEW_OWNER_INQUIRY_COMMON_NOTIFICATION_READ_INVALID",
      idempotencyKey: commonReadKey,
      method: "POST",
      sessionToken: ownerACredential.token,
    });
  const readNotification = await markCommonRead();
  if (
    readNotification?.notification?.version !== 1 ||
    !readNotification.notification.readAt
  )
    throw new Error(
      "PREVIEW_OWNER_INQUIRY_COMMON_NOTIFICATION_READ_RESPONSE_INVALID",
    );
  const replayedNotification = await markCommonRead();
  if (
    replayedNotification?.notification?.readAt !==
    readNotification.notification.readAt
  )
    throw new Error("PREVIEW_OWNER_INQUIRY_COMMON_NOTIFICATION_REPLAY_INVALID");
  const ownerBNotifications = await api("/api/notifications?limit=100", {
    failureCode:
      "PREVIEW_OWNER_INQUIRY_COMMON_NOTIFICATION_ISOLATION_LIST_INVALID",
    sessionToken: ownerBCredential.token,
  });
  if (
    ownerBNotifications.notifications?.some(
      (notification) => notification.id === commonNotification.id,
    )
  )
    throw new Error("PREVIEW_OWNER_INQUIRY_COMMON_NOTIFICATION_ISOLATION_LEAK");
  const ownerBCrossRead = await request(
    `/api/notifications/${commonNotification.id}/read`,
    {
      body: { version: 1 },
      idempotencyKey: stableUuid("common-notification-cross-read"),
      method: "POST",
      sessionToken: ownerBCredential.token,
    },
  );
  if (ownerBCrossRead.response.status !== 404 || ownerBCrossRead.payload?.data)
    throw new Error(
      "PREVIEW_OWNER_INQUIRY_COMMON_NOTIFICATION_CROSS_RECIPIENT_LEAK",
    );
  const commonNotificationsAfterRead = await api(
    "/api/notifications?limit=20",
    {
      failureCode: "PREVIEW_OWNER_INQUIRY_COMMON_NOTIFICATION_READBACK_INVALID",
      sessionToken: ownerACredential.token,
    },
  );
  if (
    commonNotificationsAfterRead.unreadCount !== commonUnreadBefore - 1 ||
    !commonNotificationsAfterRead.notifications?.some(
      (notification) =>
        notification.id === commonNotification.id &&
        notification.version === 1 &&
        notification.readAt === readNotification.notification.readAt,
    )
  )
    throw new Error(
      "PREVIEW_OWNER_INQUIRY_COMMON_NOTIFICATION_PERSISTENCE_INVALID",
    );

  const view = await request(
    `/api/hotels/${hotelId}/inquiries/${inquiryId}/files/${fileVersionId}/view`,
    {
      headers: { "sec-fetch-site": "same-origin" },
      raw: true,
      sessionToken: ownerACredential.token,
    },
  );
  const ownerBView = await request(
    `/api/hotels/${hotelId}/inquiries/${inquiryId}/files/${fileVersionId}/view`,
    {
      headers: { "sec-fetch-site": "same-origin" },
      raw: true,
      sessionToken: ownerBCredential.token,
    },
  );
  if (ownerBView.response.status !== 404)
    throw new Error("PREVIEW_OWNER_INQUIRY_CROSS_OWNER_FILE_LEAK");
  const viewedBody = Buffer.from(await view.response.arrayBuffer());
  const expectedOptimized = await optimizeEvidenceImage(png, "image/png");
  if (!view.response.ok)
    throw new Error("PREVIEW_OWNER_INQUIRY_FILE_VIEW_STATUS_INVALID");
  if (!viewedBody.equals(Buffer.from(expectedOptimized.body)))
    throw new Error("PREVIEW_OWNER_INQUIRY_FILE_VIEW_BODY_INVALID");
  if (view.response.headers.get("content-type") !== expectedOptimized.mimeType)
    throw new Error("PREVIEW_OWNER_INQUIRY_FILE_VIEW_MIME_INVALID");
  if (view.response.headers.get("cache-control") !== "private, no-store")
    throw new Error("PREVIEW_OWNER_INQUIRY_FILE_VIEW_CACHE_INVALID");
  if (view.response.headers.get("x-content-type-options") !== "nosniff")
    throw new Error("PREVIEW_OWNER_INQUIRY_FILE_VIEW_NOSNIFF_INVALID");
  if (
    view.response.headers.get("content-disposition") !==
    expectedContentDisposition("Preview 문의 첨부.png")
  )
    throw new Error("PREVIEW_OWNER_INQUIRY_FILE_VIEW_DISPOSITION_INVALID");
  if (/[\r\n]/u.test(view.response.headers.get("content-disposition") ?? ""))
    throw new Error("PREVIEW_OWNER_INQUIRY_FILE_VIEW_DISPOSITION_CRLF");
  const contentLength = view.response.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) !== viewedBody.byteLength)
    throw new Error("PREVIEW_OWNER_INQUIRY_FILE_VIEW_LENGTH_INVALID");

  const [databaseReadback] = await ownerSql`
    select inquiry.status,
      exists(select 1 from public.hotel_inquiry_messages message where message.company_id=inquiry.company_id and message.inquiry_id=inquiry.id and message.body='Preview 공개 답변') as public_saved,
      exists(select 1 from public.hotel_inquiry_messages message where message.company_id=inquiry.company_id and message.inquiry_id=inquiry.id and message.body='Preview 내부 검토' and message.visibility='INTERNAL') as internal_saved,
      exists(select 1 from public.hotel_inquiry_message_attachments attachment where attachment.company_id=inquiry.company_id and attachment.inquiry_id=inquiry.id and attachment.file_version_id=${fileVersionId}::uuid) as attachment_saved,
      exists(select 1 from public.hotel_inquiry_notifications notification where notification.company_id=inquiry.company_id and notification.inquiry_id=inquiry.id and notification.event_code='HOTEL_INQUIRY_AUTO_CLOSE') as notification_saved,
      exists(select 1 from public.audit_events audit where audit.company_id=inquiry.company_id and audit.resource_id=inquiry.id and audit.event_code='HOTEL_INQUIRY_AUTO_CLOSE' and audit.actor_type='SYSTEM') as auto_close_audited
    from public.hotel_inquiries inquiry
    where inquiry.company_id=${principal.company_id}::uuid and inquiry.branch_id=${hotelId}::uuid and inquiry.id=${inquiryId}::uuid
  `;
  if (
    databaseReadback?.status !== "CLOSED" ||
    !databaseReadback.public_saved ||
    !databaseReadback.internal_saved ||
    !databaseReadback.attachment_saved ||
    !databaseReadback.notification_saved ||
    !databaseReadback.auto_close_audited
  )
    throw new Error("PREVIEW_OWNER_INQUIRY_DATABASE_READBACK_INVALID");
  console.log("PREVIEW_OWNER_INQUIRY_API_DB_SMOKE_OK");

  failureStage = "UI";
  browser = await chromium.launch({ headless: true });
  await verifyUi(
    { width: 390, height: 844 },
    "MOBILE_OWNER",
    title,
    ownerACredential.token,
    false,
  );
  await verifyUi(
    { width: 1440, height: 1000 },
    "DESKTOP_INTERNAL",
    title,
    internalCredential.token,
    true,
  );
  console.log("PREVIEW_OWNER_INQUIRY_UI_SMOKE_OK");
  console.log("PREVIEW_INQUIRY_NOTIFICATION_SMOKE_OK");
  if (process.env.OWNER_INQUIRY_SMOKE_PHASE === "POST_CONTRACT")
    console.log("PREVIEW_OWNER_INQUIRY_POST_CONTRACT_SMOKE_OK");
} catch (error) {
  const code =
    error instanceof Error &&
    /^PREVIEW_OWNER_INQUIRY_[A-Z0-9_]+$/u.test(error.message)
      ? error.message
      : `PREVIEW_OWNER_INQUIRY_FAILED_${failureStage}`;
  console.error(code);
  try {
    await terminalizeFailedCanary();
  } catch (cleanupError) {
    const cleanupCode =
      cleanupError instanceof Error &&
      /^PREVIEW_OWNER_INQUIRY_CLEANUP_[A-Z0-9_]+$/u.test(cleanupError.message)
        ? cleanupError.message
        : "PREVIEW_OWNER_INQUIRY_CLEANUP_TERMINALIZATION_FAILED";
    console.error(cleanupCode);
  }
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => undefined);
  if (createdGrantIds.length > 0) {
    await ownerSql`delete from public.permission_grants where id=any(${createdGrantIds}::uuid[])`.catch(
      () => {
        console.error("PREVIEW_OWNER_INQUIRY_CLEANUP_GRANTS_FAILED");
        process.exitCode = 1;
      },
    );
  }
  for (const sessionTokenHash of createdSessionHashes) {
    await sql`select * from public.auth_revoke_session_v2(${sessionTokenHash},'Preview 소유주 문의 smoke cleanup',${randomUUID()}::uuid)`.catch(
      () => {
        console.error("PREVIEW_OWNER_INQUIRY_CLEANUP_SESSION_FAILED");
        process.exitCode = 1;
      },
    );
  }
  await reconcilerSql.end({ timeout: 5 }).catch(() => undefined);
  await ownerSql.end({ timeout: 5 }).catch(() => undefined);
  await sql.end({ timeout: 5 }).catch(() => undefined);
}
