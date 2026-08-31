import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
import { runFileScannerBatch } from "../apps/file-processor/src/batch.ts";
import { scanWithClamAv } from "../apps/file-processor/src/clamav.ts";
import { optimizeEvidenceImage } from "../apps/file-processor/src/image-processor.ts";

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
const scannerAgentToken = process.env.PREVIEW_FILE_SCANNER_AGENT_TOKEN?.trim();
const phase = process.env.KNOWLEDGE_SMOKE_PHASE ?? "PRE_CONTRACT";
if (
  !baseUrl?.startsWith("https://") ||
  !bootstrapSubject ||
  !apiUrlFile ||
  !ownerDatabaseUrl ||
  !scannerAgentToken ||
  scannerAgentToken.length < 32 ||
  scannerAgentToken.length > 256 ||
  !["PRE_CONTRACT", "POST_CONTRACT"].includes(phase)
)
  throw new Error("PREVIEW_KNOWLEDGE_CONFIGURATION_INVALID");

const sql = postgres((await readFile(apiUrlFile, "utf8")).trim(), {
  max: 1,
  prepare: false,
});
const ownerSql = postgres(ownerDatabaseUrl, { max: 1, prepare: false });
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const expectedOptimized = await optimizeEvidenceImage(png, "image/png");
const releaseAttempt = [
  process.env.GITHUB_SHA,
  process.env.GITHUB_RUN_ID,
  process.env.GITHUB_RUN_ATTEMPT,
]
  .filter(Boolean)
  .join(":");
const canarySeed = `${releaseAttempt || process.env.KNOWLEDGE_CANARY_SEED || randomUUID()}:${phase}`;
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
const stableUuid = (label) => uuidFromSeed(canarySeed, label);
const fixtureUuid = (label) =>
  uuidFromSeed("werehere-preview-knowledge-fixture-v1", label);
function sessionCredential() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: createHash("sha256").update(token, "utf8").digest(),
    sessionId: randomUUID(),
  };
}
const bootstrapCredential = sessionCredential();
const authorCredential = sessionCredential();
const reviewerCredential = sessionCredential();
const isolationCredential = sessionCredential();
let authorUserId;
let authorIdentityId;
let authorAssignmentId;
let authorSubject;
let reviewerUserId;
let reviewerIdentityId;
let reviewerAssignmentId;
let reviewerSubject;
let isolationUserId;
let isolationIdentityId;
let isolationAssignmentId;
let isolationSubject;
const hotelKnowledgeId = stableUuid("hotel-knowledge");
const companyKnowledgeId = stableUuid("company-knowledge");
const highRiskKnowledgeId = stableUuid("high-risk-knowledge");
const searchTerm = `Preview지식${stableUuid("search").slice(0, 8)}`;
const fullToken = `회사전체토큰${stableUuid("full-token").slice(0, 6)}`;
const partialContainer = `희귀냉각징후${stableUuid("partial").slice(0, 6)}`;
const partialQuery = partialContainer.slice(2, -2);
const title = `${searchTerm} 냉방 점검`;
const updatedTitle = `${title} 보완`;
const companyTitle = `${searchTerm} 회사 공통 안내`;
const highRiskTitle = `${searchTerm} 감전 안전 대응`;
const authorPermissions = [
  "KNOWLEDGE_READ",
  "KNOWLEDGE_CREATE",
  "HOTEL_FILE_UPLOAD",
  "HOTEL_FILE_READ",
];
const reviewerPermissions = [
  "KNOWLEDGE_READ",
  "KNOWLEDGE_REVIEW",
  "KNOWLEDGE_PUBLISH",
  "KNOWLEDGE_HIGH_RISK_PUBLISH",
  "KNOWLEDGE_ARCHIVE",
];
const sessionHashes = [];
let authorPrincipal;
let bootstrapPrincipal;
let hotelId;
let otherHotelId;
let browser;
let failureStage = "SESSION";

const forbiddenProjectionKeys = new Set([
  "bucket",
  "bucketname",
  "objectkey",
  "objectversion",
  "etag",
  "r2bucket",
  "r2key",
  "storagekey",
  "providerurl",
  "scannerresult",
  "scanneroutput",
  "scannerinternal",
  "clamavresult",
  "clamavoutput",
]);
function assertPrivateProjection(value) {
  if (typeof value === "string" && /^https?:\/\//iu.test(value)) {
    let exposedUrl;
    try {
      exposedUrl = new URL(value);
    } catch {
      throw new Error("PREVIEW_KNOWLEDGE_PRIVATE_METADATA_EXPOSED");
    }
    if (exposedUrl.origin !== new URL(baseUrl).origin)
      throw new Error("PREVIEW_KNOWLEDGE_PRIVATE_METADATA_EXPOSED");
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) assertPrivateProjection(item);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = key.replaceAll(/[^a-z0-9]/giu, "").toLowerCase();
    if (
      forbiddenProjectionKeys.has(normalizedKey) ||
      normalizedKey.startsWith("scanner") ||
      normalizedKey.startsWith("clamav")
    )
      throw new Error("PREVIEW_KNOWLEDGE_PRIVATE_METADATA_EXPOSED");
    assertPrivateProjection(nested);
  }
}

function assertCanonicalHiddenNotFound(result, failureCode) {
  const payload = result.payload;
  const error = payload?.error;
  if (
    result.response.status !== 404 ||
    JSON.stringify(Object.keys(payload ?? {}).sort()) !==
      JSON.stringify(["data", "error", "ok"]) ||
    payload.ok !== false ||
    payload.data !== null ||
    JSON.stringify(Object.keys(error ?? {}).sort()) !==
      JSON.stringify([
        "code",
        "fieldErrors",
        "message",
        "retryAfterSeconds",
        "retryable",
        "traceId",
      ]) ||
    error.code !== "RESOURCE_NOT_FOUND" ||
    error.message !== "호텔 요청을 처리할 수 없습니다." ||
    !Array.isArray(error.fieldErrors) ||
    error.fieldErrors.length !== 0 ||
    error.retryable !== false ||
    error.retryAfterSeconds !== null ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      error.traceId,
    )
  )
    throw new Error(failureCode);
}

async function request(path, options = {}) {
  const targetUrl = new URL(path, baseUrl);
  if (targetUrl.origin !== new URL(baseUrl).origin)
    throw new Error("PREVIEW_KNOWLEDGE_CROSS_ORIGIN_REQUEST_REJECTED");
  const headers = {
    accept: options.raw ? "*/*" : "application/json",
    cookie: `__Host-hotel_session=${options.sessionToken ?? authorCredential.token}`,
    ...(options.headers ?? {}),
  };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.idempotencyKey)
    headers["idempotency-key"] = options.idempotencyKey;
  const response = await fetch(targetUrl, {
    body:
      options.rawBody ??
      (options.body === undefined ? undefined : JSON.stringify(options.body)),
    headers,
    method: options.method ?? "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  if (options.simulatePostCommitResponseLoss && response.ok)
    throw new Error("PREVIEW_KNOWLEDGE_INJECTED_POST_COMMIT_RESPONSE_LOSS");
  const payload = options.raw
    ? undefined
    : await response
        .clone()
        .json()
        .catch(() => undefined);
  assertPrivateProjection(payload);
  return {
    payload,
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
      `${options.failureCode ?? "PREVIEW_KNOWLEDGE_API_INVALID"}${safeCode ? `_${safeCode}` : ""}`,
    );
  }
  return payload.data;
}
async function expectDenied(
  path,
  options,
  expectedStatus,
  expectedCode,
  auditCode,
) {
  const { payload, response } = await request(path, options);
  if (
    response.status !== expectedStatus ||
    payload?.ok !== false ||
    payload?.data !== null ||
    payload?.error?.code !== expectedCode
  )
    throw new Error(options.failureCode);
  if (auditCode) {
    const [audit] = await ownerSql`
      select count(*)::int as count from public.audit_events
       where company_id=${authorPrincipal.company_id}::uuid
         and resource_id=${options.resourceId}::uuid
         and event_code=${auditCode} and result='DENIED' and after_summary='{}'::jsonb`;
    if (audit?.count !== 1) throw new Error(`${options.failureCode}_AUDIT`);
  }
}
async function transition(id, entry, action, reason, credential, label) {
  const data = await api(`/api/knowledge/${id}/transitions`, {
    body: { action, reason, version: entry.version },
    failureCode: `PREVIEW_KNOWLEDGE_${label}_INVALID`,
    idempotencyKey: stableUuid(`transition:${label}`),
    method: "POST",
    sessionToken: credential.token,
  });
  if (data?.entry?.id !== id || typeof data.entry.version !== "number")
    throw new Error(`PREVIEW_KNOWLEDGE_${label}_RESPONSE_INVALID`);
  return data.entry;
}
function content(scopeType, entryTitle, riskClassification = "STANDARD") {
  return {
    caseSummary: "필터 상태를 확인해 정상 냉방을 복구한 사례입니다.",
    checks: [
      "설정 온도와 운전 모드를 확인합니다.",
      "흡입구 막힘 여부를 확인합니다.",
    ],
    designatedReviewerUserId:
      riskClassification === "STANDARD" ? null : reviewerUserId,
    escalationCriteria:
      "과열 또는 전기 냄새가 있으면 즉시 관리자에게 보고합니다.",
    hotelId: scopeType === "HOTEL" ? hotelId : null,
    knowledgeType:
      riskClassification === "STANDARD"
        ? "FACILITY_MAINTENANCE"
        : "SAFETY_CAUTION",
    outcomeAndLesson: "월별 필터 확인으로 재발 가능성을 낮췄습니다.",
    prohibitedOrCautionResponse: ["전기 덮개를 임의로 분해하지 않습니다."],
    recommendedResponse: ["안전하게 전원을 끄고 필터 상태를 확인합니다."],
    relatedIssueIds: [],
    relatedManualRefs: ["시설 안전 매뉴얼"],
    relatedRepairIds: [],
    requiredPermissionOrApproval: "판매중지는 관리자 승인이 필요합니다.",
    reviewDueAt: "2099-12-31T00:00:00.000Z",
    riskClassification,
    scopeType,
    situation: "객실 냉방이 약하거나 전기 설비 이상이 의심되는 상황입니다.",
    summary: "현장에서 안전하게 확인할 순서와 관리자 보고 기준입니다.",
    symptomsAndContext:
      "송풍은 되지만 온도가 내려가지 않거나 전기 냄새가 납니다.",
    tags: ["Preview", "냉방"],
    title: entryTitle,
  };
}
async function createEntry(id, body, label) {
  const data = await api("/api/knowledge", {
    body: { id, ...body },
    failureCode: `PREVIEW_KNOWLEDGE_${label}_CREATE_INVALID`,
    idempotencyKey: stableUuid(`create:${label}`),
    method: "POST",
  });
  if (data?.entry?.id !== id || data.entry.status !== "DRAFT")
    throw new Error(`PREVIEW_KNOWLEDGE_${label}_CREATE_READBACK_INVALID`);
  return data.entry;
}
async function initUpload(knowledgeId, label) {
  const initialized = await api(
    `/api/knowledge/${knowledgeId}/files/upload-init`,
    {
      body: {
        fileName: `${label}.png`,
        mimeType: "image/png",
        parent: { knowledgeId, type: "KNOWLEDGE_ATTACHMENT" },
        sizeBytes: png.length,
      },
      failureCode: "PREVIEW_KNOWLEDGE_UPLOAD_INIT_INVALID",
      idempotencyKey: stableUuid(`upload-init:${label}`),
      method: "POST",
    },
  );
  if (!initialized?.upload?.id || !initialized.uploadUrl?.endsWith("/body"))
    throw new Error("PREVIEW_KNOWLEDGE_UPLOAD_INIT_RESPONSE_INVALID");
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
  if (uploaded.response.status !== 204 || !etag)
    throw new Error("PREVIEW_KNOWLEDGE_UPLOAD_BODY_INVALID");
  await api(`/api/files/uploads/${initialized.upload.id}/complete`, {
    body: { etag },
    failureCode: "PREVIEW_KNOWLEDGE_UPLOAD_COMPLETE_INVALID",
    idempotencyKey: stableUuid(`upload-complete:${label}`),
    method: "POST",
  });
  return { knowledgeId, uploadId: initialized.upload.id };
}
async function scanUploads(uploads) {
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
    const statuses = await Promise.all(
      uploads.map((upload) =>
        api(
          `/api/knowledge/${upload.knowledgeId}/files/uploads/${upload.uploadId}/status`,
          {
            failureCode: "PREVIEW_KNOWLEDGE_UPLOAD_STATUS_INVALID",
          },
        ),
      ),
    );
    if (
      statuses.every(
        (data) =>
          data?.upload?.status === "READY_UNLINKED" &&
          data.upload.fileVersionId,
      )
    )
      return statuses.map((data) => data.upload.fileVersionId);
    if (
      statuses.some((data) =>
        ["EXPIRED", "REJECTED", "SCAN_FAILED"].includes(data?.upload?.status),
      )
    )
      throw new Error("PREVIEW_KNOWLEDGE_UPLOAD_SCAN_FAILED");
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error("PREVIEW_KNOWLEDGE_UPLOAD_SCAN_TIMEOUT");
}
async function linkWithResponseLossReplay(entry, fileVersionId, label) {
  const attachmentLinkKey = stableUuid(`attachment-link:${label}`);
  const attachmentLinkBody = {
    fileVersionIds: [fileVersionId],
    reason: "Preview private 첨부 연결",
    version: entry.version,
  };
  let ambiguousKind = "TRANSPORT";
  try {
    const first = await request(`/api/knowledge/${entry.id}/attachments`, {
      body: attachmentLinkBody,
      idempotencyKey: attachmentLinkKey,
      method: "PUT",
      simulatePostCommitResponseLoss: true,
    });
    if (first.response.status < 500)
      throw new Error("PREVIEW_KNOWLEDGE_ATTACHMENT_FIRST_COMMIT_INVALID");
    ambiguousKind = "HTTP_5XX";
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PREVIEW_KNOWLEDGE_INJECTED_POST_COMMIT_RESPONSE_LOSS"
    ) {
      ambiguousKind = "INJECTED_POST_COMMIT";
    } else if (
      error instanceof Error &&
      error.message.startsWith("PREVIEW_KNOWLEDGE_")
    ) {
      throw error;
    }
  }
  const [ambiguousReadback] = await ownerSql`
    select count(*)::int as count from public.hotel_knowledge_attachments
     where company_id=${authorPrincipal.company_id}::uuid
       and knowledge_id=${entry.id}::uuid
       and file_version_id=${fileVersionId}::uuid`;
  if (
    ambiguousReadback?.count > 1 ||
    (ambiguousKind === "INJECTED_POST_COMMIT" && ambiguousReadback?.count !== 1)
  )
    throw new Error("PREVIEW_KNOWLEDGE_ATTACHMENT_AMBIGUOUS_READBACK_INVALID");
  const replay = await api(`/api/knowledge/${entry.id}/attachments`, {
    body: attachmentLinkBody,
    failureCode: "PREVIEW_KNOWLEDGE_ATTACHMENT_REPLAY_INVALID",
    idempotencyKey: attachmentLinkKey,
    method: "PUT",
  });
  if (
    replay?.entry?.attachments?.length !== 1 ||
    replay.entry.attachments[0]?.id !== fileVersionId
  )
    throw new Error("PREVIEW_KNOWLEDGE_ATTACHMENT_REPLAY_INVALID");
  return replay.entry;
}
async function verifyAttachmentReplayCardinality(
  knowledgeId,
  fileVersionId,
  label,
) {
  const [readback] = await ownerSql`
    select
      (select count(*)::int from public.hotel_knowledge_attachments attachment
        where attachment.company_id=${authorPrincipal.company_id}::uuid
          and attachment.knowledge_id=${knowledgeId}::uuid) as total_attachment_count,
      (select count(*)::int from public.hotel_knowledge_attachments attachment
        where attachment.company_id=${authorPrincipal.company_id}::uuid
          and attachment.knowledge_id=${knowledgeId}::uuid
          and attachment.file_version_id=${fileVersionId}::uuid) as attachment_count,
      (select count(*)::int from public.hotel_knowledge_versions version
        where version.company_id=${authorPrincipal.company_id}::uuid
          and version.knowledge_id=${knowledgeId}::uuid
          and version.action='ATTACHMENTS_UPDATE') as version_count,
      (select count(*)::int from public.audit_events audit
        where audit.company_id=${authorPrincipal.company_id}::uuid
          and audit.resource_id=${knowledgeId}::uuid
          and audit.event_code='KNOWLEDGE_ATTACHMENTS_UPDATE'
          and audit.actor_user_id=${authorUserId}::uuid and audit.result='SUCCEEDED') as audit_count,
      (select count(*)::int from public.idempotency_records receipt
        where receipt.company_id=${authorPrincipal.company_id}::uuid
          and receipt.actor_user_id=${authorUserId}::uuid
          and receipt.idempotency_key=${stableUuid(`attachment-link:${label}`)}
          and receipt.http_method='PUT'
          and receipt.operation_path=${`/api/knowledge/${knowledgeId}/attachments`}
          and receipt.status='COMPLETED' and receipt.resource_id=${knowledgeId}::uuid) as receipt_count`;
  if (
    readback?.total_attachment_count !== 1 ||
    readback?.attachment_count !== 1 ||
    readback?.version_count !== 1 ||
    readback?.audit_count !== 1 ||
    readback?.receipt_count !== 1
  )
    throw new Error("PREVIEW_KNOWLEDGE_ATTACHMENT_CARDINALITY_INVALID");
}
async function verifyCompanyLifecycle(companyAttachmentFileVersionId) {
  const [readback] = await ownerSql`
    select entry.status,
      (select jsonb_agg(jsonb_build_object(
        'version',version.entry_version,'action',version.action,'status',version.status,
        'actorUserId',version.actor_user_id,
        'attachmentFileVersionIds',version.snapshot->'attachmentFileVersionIds'
      ) order by version.entry_version)
       from public.hotel_knowledge_versions version
       where version.company_id=entry.company_id and version.knowledge_id=entry.id) as versions,
      (select jsonb_agg(jsonb_build_object(
        'eventCode',audit.event_code,'actorUserId',audit.actor_user_id,'result',audit.result
      ) order by audit.created_at,audit.id)
       from public.audit_events audit
       where audit.company_id=entry.company_id and audit.resource_id=entry.id
         and audit.event_code in('KNOWLEDGE_CREATE','KNOWLEDGE_ATTACHMENTS_UPDATE','KNOWLEDGE_REQUEST_REVIEW','KNOWLEDGE_PUBLISH','KNOWLEDGE_MARK_NEEDS_REVIEW','KNOWLEDGE_UPDATE','KNOWLEDGE_REPUBLISH','KNOWLEDGE_ARCHIVE')) as audits
    from public.hotel_knowledge_entries entry
    where entry.company_id=${authorPrincipal.company_id}::uuid
      and entry.id=${companyKnowledgeId}::uuid`;
  const actions = [
    "CREATE",
    "ATTACHMENTS_UPDATE",
    "REQUEST_REVIEW",
    "PUBLISH",
    "MARK_NEEDS_REVIEW",
    "UPDATE",
    "REQUEST_REVIEW",
    "REPUBLISH",
    "ARCHIVE",
  ];
  const statuses = [
    "DRAFT",
    "DRAFT",
    "REVIEW_REQUESTED",
    "PUBLISHED",
    "NEEDS_REVIEW",
    "NEEDS_REVIEW",
    "REVIEW_REQUESTED",
    "PUBLISHED",
    "ARCHIVED",
  ];
  const actors = [
    authorUserId,
    authorUserId,
    authorUserId,
    reviewerUserId,
    reviewerUserId,
    authorUserId,
    authorUserId,
    reviewerUserId,
    reviewerUserId,
  ];
  if (
    readback?.status !== "ARCHIVED" ||
    readback.versions?.length !== actions.length ||
    readback.audits?.length !== actions.length ||
    !readback.versions.every(
      (version, index) =>
        version.version === index + 1 &&
        version.action === actions[index] &&
        version.status === statuses[index] &&
        version.actorUserId === actors[index] &&
        Array.isArray(version.attachmentFileVersionIds) &&
        (index === 0
          ? version.attachmentFileVersionIds.length === 0
          : version.attachmentFileVersionIds.length === 1 &&
            version.attachmentFileVersionIds[0] ===
              companyAttachmentFileVersionId),
    ) ||
    !readback.audits.every(
      (audit, index) =>
        audit.eventCode === `KNOWLEDGE_${actions[index]}` &&
        audit.actorUserId === actors[index] &&
        audit.result === "SUCCEEDED",
    )
  )
    throw new Error("PREVIEW_KNOWLEDGE_COMPANY_LIFECYCLE_READBACK_INVALID");
}
async function verifyUi(viewport, label) {
  const context = await browser.newContext({ viewport });
  await context.addCookies([
    {
      httpOnly: true,
      name: "__Host-hotel_session",
      sameSite: "Lax",
      secure: true,
      url: baseUrl,
      value: authorCredential.token,
    },
  ]);
  const page = await context.newPage();
  const response = await page.goto(`${baseUrl}/knowledge`, {
    timeout: 120_000,
    waitUntil: "domcontentloaded",
  });
  if (
    !response?.ok() ||
    ["/login", "/account/initial-password"].includes(
      new URL(page.url()).pathname,
    )
  )
    throw new Error(`PREVIEW_KNOWLEDGE_${label}_DOCUMENT_INVALID`);
  await page
    .locator("[data-knowledge-workspace]")
    .waitFor({ state: "visible", timeout: 30_000 });
  const search = page.getByLabel("증상·상황 검색", { exact: true });
  await search.fill(searchTerm);
  await page.keyboard.press("Enter");
  await page
    .getByText(updatedTitle, { exact: true })
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  await search.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const resultButton = page
    .getByRole("button", { name: new RegExp(updatedTitle, "u") })
    .first();
  if (
    !(await resultButton.evaluate(
      (element) =>
        document.activeElement === element && element.matches(":focus-visible"),
    ))
  )
    throw new Error(`PREVIEW_KNOWLEDGE_${label}_KEYBOARD_RESULT_FOCUS_INVALID`);
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { level: 2, name: updatedTitle }).waitFor({
    state: "visible",
    timeout: 30_000,
  });
  if (
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
  )
    throw new Error(`PREVIEW_KNOWLEDGE_${label}_OVERFLOW`);
  const axe = await new AxeBuilder({ page })
    .include("[data-knowledge-workspace]")
    .analyze();
  if (axe.violations.length)
    throw new Error(`PREVIEW_KNOWLEDGE_${label}_AXE_FAILED`);
  await context.close();
}

async function cleanupFixtureAuthority(cleanupFixtureUserIds) {
  await ownerSql.begin(async (tx) => {
    await tx`delete from public.permission_grants
      where company_id=${bootstrapPrincipal.company_id}::uuid
        and subject_type='USER' and subject_id=any(${cleanupFixtureUserIds}::uuid[])`;
    await tx`delete from public.user_role_memberships
      where company_id=${bootstrapPrincipal.company_id}::uuid and user_id=any(${cleanupFixtureUserIds}::uuid[])`;
    await tx`delete from public.user_group_memberships
      where company_id=${bootstrapPrincipal.company_id}::uuid and user_id=any(${cleanupFixtureUserIds}::uuid[])`;
  });
  const [remainingAuthority] = await ownerSql`
    select
      (select count(*)::int from public.permission_grants
        where company_id=${bootstrapPrincipal.company_id}::uuid and subject_type='USER'
          and subject_id=any(${cleanupFixtureUserIds}::uuid[])) as grant_count,
      (select count(*)::int from public.user_role_memberships
        where company_id=${bootstrapPrincipal.company_id}::uuid
          and user_id=any(${cleanupFixtureUserIds}::uuid[])) as role_count,
      (select count(*)::int from public.user_group_memberships
        where company_id=${bootstrapPrincipal.company_id}::uuid
          and user_id=any(${cleanupFixtureUserIds}::uuid[])) as group_count`;
  if (
    remainingAuthority?.grant_count !== 0 ||
    remainingAuthority?.role_count !== 0 ||
    remainingAuthority?.group_count !== 0
  )
    throw new Error("AUTHORITY_STILL_PRESENT");
}
async function revokeAndVerifySession(tokenHash) {
  const [before] = await ownerSql`
    select count(*)::int as active_count from public.auth_sessions
     where token_hash=${tokenHash} and revoked_at is null`;
  if (before?.active_count === 1) {
    const [revoked] = await sql`
      select public.auth_revoke_session_v2(${tokenHash},'Preview 지식 smoke cleanup',${randomUUID()}::uuid) as revoked`;
    if (revoked?.revoked !== true) throw new Error("SESSION_REVOKE_FALSE");
  } else if (before?.active_count !== 0) {
    throw new Error("SESSION_CARDINALITY_INVALID");
  }
  const [after] = await ownerSql`
    select count(*)::int as active_count from public.auth_sessions
     where token_hash=${tokenHash} and revoked_at is null`;
  if (after?.active_count !== 0) throw new Error("SESSION_STILL_ACTIVE");
}

try {
  sessionHashes.push(bootstrapCredential.tokenHash);
  const bootstrapSessions =
    await sql`select * from public.auth_create_session_v2(${bootstrapCredential.sessionId}::uuid,${bootstrapCredential.tokenHash},${bootstrapSubject},28800,86400,statement_timestamp(),${randomUUID()}::uuid)`;
  bootstrapPrincipal = bootstrapSessions[0];
  if (
    bootstrapSessions.length !== 1 ||
    bootstrapPrincipal?.result_status !== "CREATED" ||
    bootstrapPrincipal.user_type !== "INTERNAL_STAFF"
  )
    throw new Error("PREVIEW_KNOWLEDGE_BOOTSTRAP_SESSION_FAILED");
  const [scope] = await ownerSql`
    select assignment.branch_id from public.hotel_staff_assignments assignment
    join public.branches branch on branch.company_id=assignment.company_id and branch.id=assignment.branch_id
    join public.hotel_profiles hotel on hotel.company_id=assignment.company_id and hotel.branch_id=assignment.branch_id
    where assignment.company_id=${bootstrapPrincipal.company_id}::uuid and assignment.user_id=${bootstrapPrincipal.user_id}::uuid
      and assignment.terminated_at is null and assignment.start_date<=statement_timestamp()::date
      and (assignment.end_date is null or assignment.end_date>=statement_timestamp()::date)
      and branch.branch_type='HOTEL' and branch.status='ACTIVE' and hotel.hotel_status='ACTIVE'
    order by assignment.created_at,assignment.id limit 1`;
  hotelId = scope?.branch_id;
  if (!hotelId) throw new Error("PREVIEW_KNOWLEDGE_HOTEL_UNAVAILABLE");
  const [otherScope] = await ownerSql`
    select branch.id as branch_id from public.branches branch
      join public.hotel_profiles hotel on hotel.company_id=branch.company_id and hotel.branch_id=branch.id
     where branch.company_id=${bootstrapPrincipal.company_id}::uuid and branch.id<>${hotelId}::uuid
       and branch.branch_type='HOTEL' and branch.status='ACTIVE' and hotel.hotel_status='ACTIVE'
     order by branch.id limit 1`;
  otherHotelId = otherScope?.branch_id;
  if (!otherHotelId)
    throw new Error("PREVIEW_KNOWLEDGE_OTHER_HOTEL_UNAVAILABLE");

  const fixtureScope = `${bootstrapPrincipal.company_id}:${hotelId}`;
  authorUserId = fixtureUuid(`${fixtureScope}:author-user`);
  authorIdentityId = fixtureUuid(`${fixtureScope}:author-identity`);
  authorAssignmentId = fixtureUuid(`${fixtureScope}:author-assignment`);
  authorSubject = `preview-knowledge-author-${createHash("sha256").update(fixtureScope).digest("hex").slice(0, 24)}`;
  reviewerUserId = fixtureUuid(`${fixtureScope}:reviewer-user`);
  reviewerIdentityId = fixtureUuid(`${fixtureScope}:reviewer-identity`);
  reviewerAssignmentId = fixtureUuid(`${fixtureScope}:reviewer-assignment`);
  reviewerSubject = `preview-knowledge-reviewer-${createHash("sha256").update(fixtureScope).digest("hex").slice(0, 24)}`;
  isolationUserId = fixtureUuid(`${fixtureScope}:isolation-user`);
  isolationIdentityId = fixtureUuid(`${fixtureScope}:isolation-identity`);
  isolationAssignmentId = fixtureUuid(`${fixtureScope}:isolation-assignment`);
  isolationSubject = `preview-knowledge-isolation-${createHash("sha256").update(fixtureScope).digest("hex").slice(0, 24)}`;

  failureStage = "ACTOR_FIXTURES";
  await ownerSql.begin(async (tx) => {
    for (const fixture of [
      {
        userId: authorUserId,
        identityId: authorIdentityId,
        assignmentId: authorAssignmentId,
        subject: authorSubject,
        branchId: hotelId,
        name: "Preview 지식 작성자",
      },
      {
        userId: reviewerUserId,
        identityId: reviewerIdentityId,
        assignmentId: reviewerAssignmentId,
        subject: reviewerSubject,
        branchId: hotelId,
        name: "Preview 지식 독립 검토자",
      },
      {
        userId: isolationUserId,
        identityId: isolationIdentityId,
        assignmentId: isolationAssignmentId,
        subject: isolationSubject,
        branchId: otherHotelId,
        name: "Preview 지식 격리 검증자",
      },
    ]) {
      await tx`insert into public.users(id,company_id,user_type,display_name) values(${fixture.userId}::uuid,${bootstrapPrincipal.company_id}::uuid,'INTERNAL_STAFF',${fixture.name}) on conflict(id)do nothing`;
      await tx`insert into public.auth_identities(id,company_id,user_id,provider,provider_subject) values(${fixture.identityId}::uuid,${bootstrapPrincipal.company_id}::uuid,${fixture.userId}::uuid,'ZITADEL',${fixture.subject}) on conflict(id)do nothing`;
      await tx`insert into public.hotel_staff_assignments(id,company_id,branch_id,user_id,assignment_type,start_date,reason,created_by) values(${fixture.assignmentId}::uuid,${bootstrapPrincipal.company_id}::uuid,${fixture.branchId}::uuid,${fixture.userId}::uuid,'PRIMARY',statement_timestamp()::date,'Preview 지식 tenant-derived fixture',${bootstrapPrincipal.user_id}::uuid) on conflict(id)do nothing`;
    }
  });
  const [fixtureReadback] = await ownerSql`
    select count(*)::int as valid_count from public.users app_user
      join public.auth_identities identity on identity.company_id=app_user.company_id and identity.user_id=app_user.id and identity.provider='ZITADEL'
      join public.hotel_staff_assignments assignment on assignment.company_id=app_user.company_id and assignment.user_id=app_user.id
     where app_user.company_id=${bootstrapPrincipal.company_id}::uuid and app_user.status='ACTIVE' and app_user.user_type='INTERNAL_STAFF'
       and assignment.assignment_type='PRIMARY' and assignment.terminated_at is null
       and assignment.start_date<=statement_timestamp()::date and(assignment.end_date is null or assignment.end_date>=statement_timestamp()::date)
       and ((app_user.id=${authorUserId}::uuid and identity.id=${authorIdentityId}::uuid and identity.provider_subject=${authorSubject} and assignment.id=${authorAssignmentId}::uuid and assignment.branch_id=${hotelId}::uuid)
         or(app_user.id=${reviewerUserId}::uuid and identity.id=${reviewerIdentityId}::uuid and identity.provider_subject=${reviewerSubject} and assignment.id=${reviewerAssignmentId}::uuid and assignment.branch_id=${hotelId}::uuid)
         or(app_user.id=${isolationUserId}::uuid and identity.id=${isolationIdentityId}::uuid and identity.provider_subject=${isolationSubject} and assignment.id=${isolationAssignmentId}::uuid and assignment.branch_id=${otherHotelId}::uuid))`;
  const [fixtureCardinality] = await ownerSql`
    select
      (select count(*)::int from public.auth_identities identity
        where identity.company_id=${bootstrapPrincipal.company_id}::uuid
          and identity.user_id=any(${[authorUserId, reviewerUserId, isolationUserId]}::uuid[])) as identity_count,
      (select count(*)::int from public.hotel_staff_assignments assignment
        where assignment.company_id=${bootstrapPrincipal.company_id}::uuid
          and assignment.user_id=any(${[authorUserId, reviewerUserId, isolationUserId]}::uuid[])
          and assignment.terminated_at is null
          and assignment.start_date<=statement_timestamp()::date
          and(assignment.end_date is null or assignment.end_date>=statement_timestamp()::date)) as active_assignment_count`;
  if (
    fixtureReadback?.valid_count !== 3 ||
    fixtureCardinality?.identity_count !== 3 ||
    fixtureCardinality?.active_assignment_count !== 3
  )
    throw new Error("PREVIEW_KNOWLEDGE_ACTOR_FIXTURES_INVALID");

  sessionHashes.push(authorCredential.tokenHash);
  const authorSessions =
    await sql`select * from public.auth_create_session_v2(${authorCredential.sessionId}::uuid,${authorCredential.tokenHash},${authorSubject},28800,86400,statement_timestamp(),${randomUUID()}::uuid)`;
  authorPrincipal = authorSessions[0];
  if (
    authorSessions.length !== 1 ||
    authorPrincipal?.result_status !== "CREATED" ||
    authorPrincipal.user_id !== authorUserId
  )
    throw new Error("PREVIEW_KNOWLEDGE_AUTHOR_SESSION_FAILED");
  sessionHashes.push(reviewerCredential.tokenHash);
  const reviewerSessions =
    await sql`select * from public.auth_create_session_v2(${reviewerCredential.sessionId}::uuid,${reviewerCredential.tokenHash},${reviewerSubject},28800,86400,statement_timestamp(),${randomUUID()}::uuid)`;
  if (
    reviewerSessions.length !== 1 ||
    reviewerSessions[0]?.result_status !== "CREATED" ||
    reviewerSessions[0]?.user_id !== reviewerUserId
  )
    throw new Error("PREVIEW_KNOWLEDGE_REVIEWER_SESSION_FAILED");
  sessionHashes.push(isolationCredential.tokenHash);
  const isolationSessions =
    await sql`select * from public.auth_create_session_v2(${isolationCredential.sessionId}::uuid,${isolationCredential.tokenHash},${isolationSubject},28800,86400,statement_timestamp(),${randomUUID()}::uuid)`;
  if (
    isolationSessions.length !== 1 ||
    isolationSessions[0]?.result_status !== "CREATED" ||
    isolationSessions[0]?.user_id !== isolationUserId
  )
    throw new Error("PREVIEW_KNOWLEDGE_ISOLATION_SESSION_FAILED");

  failureStage = "GRANTS";
  for (const permissionCode of [
    ...new Set([...authorPermissions, ...reviewerPermissions]),
  ]) {
    const [permission] =
      await ownerSql`select exists(select 1 from public.permissions where code=${permissionCode}) as present`;
    if (!permission?.present)
      throw new Error(
        `PREVIEW_KNOWLEDGE_GRANT_CATALOG_MISSING_${permissionCode}`,
      );
  }
  const intendedGrants = [];
  for (const branchId of [hotelId, null]) {
    for (const permissionCode of authorPermissions)
      intendedGrants.push({
        branchId,
        subjectId: authorUserId,
        permissionCode,
        effect: "ALLOW",
        reason: "Preview 지식 canary 권한",
      });
    for (const permissionCode of reviewerPermissions)
      intendedGrants.push({
        branchId,
        subjectId: reviewerUserId,
        permissionCode,
        effect: "ALLOW",
        reason: "Preview 지식 canary 권한",
      });
    intendedGrants.push({
      branchId,
      subjectId: reviewerUserId,
      permissionCode: "HOTEL_FILE_READ",
      effect: "DENY",
      reason: "Preview 지식 file-read DENY canary",
    });
  }
  intendedGrants.push({
    branchId: otherHotelId,
    subjectId: isolationUserId,
    permissionCode: "KNOWLEDGE_READ",
    effect: "ALLOW",
    reason: "Preview 지식 isolation canary",
  });
  intendedGrants.push({
    branchId: hotelId,
    subjectId: isolationUserId,
    permissionCode: "KNOWLEDGE_READ",
    effect: "DENY",
    reason: "Preview 지식 isolation canary",
  });
  const fixtureUserIds = [authorUserId, reviewerUserId, isolationUserId];
  await ownerSql.begin(async (tx) => {
    await tx`delete from public.permission_grants
      where company_id=${authorPrincipal.company_id}::uuid
        and subject_type='USER' and subject_id=any(${fixtureUserIds}::uuid[])`;
    await tx`delete from public.user_role_memberships
      where company_id=${authorPrincipal.company_id}::uuid and user_id=any(${fixtureUserIds}::uuid[])`;
    await tx`delete from public.user_group_memberships
      where company_id=${authorPrincipal.company_id}::uuid and user_id=any(${fixtureUserIds}::uuid[])`;
    for (const grant of intendedGrants) {
      const grantId = randomUUID();
      await tx`insert into public.permission_grants(id,company_id,branch_id,subject_type,subject_id,permission_code,effect,valid_from,granted_by,reason)
        values(${grantId}::uuid,${authorPrincipal.company_id}::uuid,${grant.branchId}::uuid,'USER',${grant.subjectId}::uuid,${grant.permissionCode},${grant.effect},statement_timestamp()-interval '1 minute',${bootstrapPrincipal.user_id}::uuid,${grant.reason})`;
    }
  });
  const grantKey = (grant) =>
    [
      grant.branch_id ?? grant.branchId ?? "COMPANY",
      grant.subject_id ?? grant.subjectId,
      grant.permission_code ?? grant.permissionCode,
      grant.effect,
      grant.reason,
    ].join("|");
  const actualGrantRows = await ownerSql`
    select branch_id,subject_id,permission_code,effect,reason,granted_by,valid_from,valid_until
      from public.permission_grants
     where company_id=${authorPrincipal.company_id}::uuid
       and subject_type='USER' and subject_id=any(${fixtureUserIds}::uuid[])
     order by branch_id nulls first,subject_id,permission_code,effect,reason`;
  const [membershipReadback] = await ownerSql`
    select
      (select count(*)::int from public.user_role_memberships
        where company_id=${authorPrincipal.company_id}::uuid and user_id=any(${fixtureUserIds}::uuid[])) as role_count,
      (select count(*)::int from public.user_group_memberships
        where company_id=${authorPrincipal.company_id}::uuid and user_id=any(${fixtureUserIds}::uuid[])) as group_count`;
  if (
    actualGrantRows.length !== intendedGrants.length ||
    JSON.stringify(actualGrantRows.map(grantKey).sort()) !==
      JSON.stringify(intendedGrants.map(grantKey).sort()) ||
    actualGrantRows.some(
      (grant) =>
        grant.granted_by !== bootstrapPrincipal.user_id ||
        grant.valid_until !== null ||
        new Date(grant.valid_from).getTime() > Date.now(),
    ) ||
    membershipReadback?.role_count !== 0 ||
    membershipReadback?.group_count !== 0
  )
    throw new Error("PREVIEW_KNOWLEDGE_GRANT_MATRIX_INVALID");

  failureStage = "API_DB";
  let hotelEntry = await createEntry(
    hotelKnowledgeId,
    {
      ...content("HOTEL", title),
      symptomsAndContext: `${partialContainer} 현장 증상입니다.`,
    },
    "HOTEL",
  );
  let companyEntry = await createEntry(
    companyKnowledgeId,
    {
      ...content("COMPANY", companyTitle),
      summary: `${fullToken} 회사 공통 검증 자료입니다.`,
    },
    "COMPANY",
  );
  let highRiskEntry = await createEntry(
    highRiskKnowledgeId,
    content("HOTEL", highRiskTitle, "SAFETY"),
    "HIGH_RISK",
  );
  const uploads = await Promise.all([
    initUpload(hotelKnowledgeId, "preview-hotel-knowledge"),
    initUpload(companyKnowledgeId, "preview-company-knowledge"),
  ]);
  const [hotelFileVersionId, companyFileVersionId] = await scanUploads(uploads);
  hotelEntry = await linkWithResponseLossReplay(
    hotelEntry,
    hotelFileVersionId,
    "hotel",
  );
  companyEntry = await linkWithResponseLossReplay(
    companyEntry,
    companyFileVersionId,
    "company",
  );
  await verifyAttachmentReplayCardinality(
    hotelKnowledgeId,
    hotelFileVersionId,
    "hotel",
  );
  await verifyAttachmentReplayCardinality(
    companyKnowledgeId,
    companyFileVersionId,
    "company",
  );

  hotelEntry = await transition(
    hotelKnowledgeId,
    hotelEntry,
    "REQUEST_REVIEW",
    "현장 검토를 요청합니다.",
    authorCredential,
    "HOTEL_REQUEST_REVIEW",
  );
  await expectDenied(
    `/api/knowledge/${hotelKnowledgeId}/transitions`,
    {
      body: {
        action: "PUBLISH",
        reason: "작성자 자체 게시 차단 검증",
        version: hotelEntry.version,
      },
      failureCode: "PREVIEW_KNOWLEDGE_SELF_PUBLISH_DENIAL_INVALID",
      idempotencyKey: stableUuid("self-publish-denied"),
      method: "POST",
      resourceId: hotelKnowledgeId,
    },
    403,
    "FORBIDDEN",
    "KNOWLEDGE_SELF_PUBLISH_DENIED",
  );
  hotelEntry = await transition(
    hotelKnowledgeId,
    hotelEntry,
    "PUBLISH",
    "독립 검토를 완료했습니다.",
    reviewerCredential,
    "HOTEL_PUBLISH",
  );
  companyEntry = await transition(
    companyKnowledgeId,
    companyEntry,
    "REQUEST_REVIEW",
    "회사 공통 검토를 요청합니다.",
    authorCredential,
    "COMPANY_REQUEST_REVIEW",
  );
  companyEntry = await transition(
    companyKnowledgeId,
    companyEntry,
    "PUBLISH",
    "회사 공통 독립 검토 완료",
    reviewerCredential,
    "COMPANY_PUBLISH",
  );
  highRiskEntry = await transition(
    highRiskKnowledgeId,
    highRiskEntry,
    "REQUEST_REVIEW",
    "고위험 지식 검토 요청",
    authorCredential,
    "HIGH_RISK_REQUEST_REVIEW",
  );
  highRiskEntry = await transition(
    highRiskKnowledgeId,
    highRiskEntry,
    "PUBLISH",
    "지정 검토자 안전 검토 완료",
    reviewerCredential,
    "HIGH_RISK_PUBLISH",
  );

  const list = await api(
    `/api/knowledge?search=${encodeURIComponent(searchTerm)}&page=1&pageSize=20`,
    { failureCode: "PREVIEW_KNOWLEDGE_SEARCH_INVALID" },
  );
  if (
    ![hotelKnowledgeId, companyKnowledgeId, highRiskKnowledgeId].every((id) =>
      list?.entries?.some((entry) => entry.id === id),
    )
  )
    throw new Error("PREVIEW_KNOWLEDGE_SEARCH_READBACK_INVALID");
  const fullTokenList = await api(
    `/api/knowledge?search=${encodeURIComponent(fullToken)}&page=1&pageSize=20`,
    { failureCode: "PREVIEW_KNOWLEDGE_FULL_TOKEN_SEARCH_INVALID" },
  );
  if (
    fullTokenList?.entries?.length !== 1 ||
    fullTokenList.entries[0]?.id !== companyKnowledgeId
  )
    throw new Error("PREVIEW_KNOWLEDGE_FULL_TOKEN_SEARCH_READBACK_INVALID");
  const partialList = await api(
    `/api/knowledge?search=${encodeURIComponent(partialQuery)}&page=1&pageSize=20`,
    { failureCode: "PREVIEW_KNOWLEDGE_KOREAN_PARTIAL_SEARCH_INVALID" },
  );
  if (
    partialList?.entries?.length !== 1 ||
    partialList.entries[0]?.id !== hotelKnowledgeId
  )
    throw new Error("PREVIEW_KNOWLEDGE_KOREAN_PARTIAL_SEARCH_READBACK_INVALID");
  const isolatedList = await api(
    `/api/knowledge?hotelId=${encodeURIComponent(hotelId)}&search=${encodeURIComponent(searchTerm)}&page=1&pageSize=20`,
    {
      failureCode: "PREVIEW_KNOWLEDGE_ISOLATION_LIST_INVALID",
      sessionToken: isolationCredential.token,
    },
  );
  const isolatedListKeys = Object.keys(isolatedList ?? {}).sort();
  if (
    JSON.stringify(isolatedListKeys) !==
      JSON.stringify(["entries", "page", "pageSize", "totalCount"]) ||
    isolatedList.entries.length !== 0 ||
    isolatedList.totalCount !== 0 ||
    isolatedList.page !== 1 ||
    isolatedList.pageSize !== 20 ||
    JSON.stringify(isolatedList).includes(searchTerm)
  )
    throw new Error("PREVIEW_KNOWLEDGE_ISOLATION_LIST_LEAK");
  const isolatedDetail = await request(`/api/knowledge/${hotelKnowledgeId}`, {
    sessionToken: isolationCredential.token,
  });
  assertCanonicalHiddenNotFound(
    isolatedDetail,
    "PREVIEW_KNOWLEDGE_ISOLATION_DETAIL_LEAK",
  );
  console.log("PREVIEW_KNOWLEDGE_ISOLATION_SMOKE_OK");
  const hotelDetail = await api(`/api/knowledge/${hotelKnowledgeId}`, {
    failureCode: "PREVIEW_KNOWLEDGE_DETAIL_INVALID",
  });
  if (
    hotelDetail?.entry?.attachments?.[0]?.id !== hotelFileVersionId ||
    hotelDetail.entry.history?.length < 4
  )
    throw new Error("PREVIEW_KNOWLEDGE_DETAIL_READBACK_INVALID");
  const viewed = await request(
    `/api/knowledge/${hotelKnowledgeId}/files/${hotelFileVersionId}/view`,
    {
      headers: { "sec-fetch-site": "same-origin" },
      raw: true,
    },
  );
  const viewedBody = Buffer.from(await viewed.response.arrayBuffer());
  const viewedSha256 = createHash("sha256").update(viewedBody).digest("hex");
  const [fileReadback] = await ownerSql`
    select encode(version.clean_sha256,'hex') as clean_sha256
      from public.hotel_file_versions version
     where version.company_id=${authorPrincipal.company_id}::uuid
       and version.id=${hotelFileVersionId}::uuid`;
  if (
    viewed.response.status !== 200 ||
    viewed.response.headers.get("content-type") !== "image/png" ||
    !viewedBody.equals(expectedOptimized.body) ||
    fileReadback?.clean_sha256 !== viewedSha256
  )
    throw new Error("PREVIEW_KNOWLEDGE_PRIVATE_FILE_VIEW_INVALID");
  const companyViewed = await request(
    `/api/knowledge/${companyKnowledgeId}/files/${companyFileVersionId}/view`,
    { headers: { "sec-fetch-site": "same-origin" }, raw: true },
  );
  const companyViewedBody = Buffer.from(
    await companyViewed.response.arrayBuffer(),
  );
  const companyViewedSha256 = createHash("sha256")
    .update(companyViewedBody)
    .digest("hex");
  const [companyFileReadback] = await ownerSql`
    select encode(version.clean_sha256,'hex') as clean_sha256
      from public.hotel_file_versions version
     where version.company_id=${authorPrincipal.company_id}::uuid
       and version.id=${companyFileVersionId}::uuid and version.branch_id is null`;
  if (
    companyViewed.response.status !== 200 ||
    companyViewed.response.headers.get("content-type") !== "image/png" ||
    !companyViewedBody.equals(expectedOptimized.body) ||
    companyFileReadback?.clean_sha256 !== companyViewedSha256
  )
    throw new Error("PREVIEW_KNOWLEDGE_COMPANY_PRIVATE_FILE_VIEW_INVALID");
  const reviewerDetail = await api(`/api/knowledge/${hotelKnowledgeId}`, {
    failureCode: "PREVIEW_KNOWLEDGE_REVIEWER_DETAIL_INVALID",
    sessionToken: reviewerCredential.token,
  });
  if (reviewerDetail?.entry?.attachments?.length !== 0)
    throw new Error("PREVIEW_KNOWLEDGE_DUAL_READ_GATE_INVALID");
  const deniedFile = await request(
    `/api/knowledge/${hotelKnowledgeId}/files/${hotelFileVersionId}/view`,
    {
      headers: { "sec-fetch-site": "same-origin" },
      sessionToken: reviewerCredential.token,
    },
  );
  assertCanonicalHiddenNotFound(
    deniedFile,
    "PREVIEW_KNOWLEDGE_FILE_READ_DENIAL_INVALID",
  );
  const reviewerCompanyDetail = await api(
    `/api/knowledge/${companyKnowledgeId}`,
    {
      failureCode: "PREVIEW_KNOWLEDGE_REVIEWER_COMPANY_DETAIL_INVALID",
      sessionToken: reviewerCredential.token,
    },
  );
  if (reviewerCompanyDetail?.entry?.attachments?.length !== 0)
    throw new Error("PREVIEW_KNOWLEDGE_COMPANY_DUAL_READ_GATE_INVALID");
  const deniedCompanyFile = await request(
    `/api/knowledge/${companyKnowledgeId}/files/${companyFileVersionId}/view`,
    {
      headers: { "sec-fetch-site": "same-origin" },
      sessionToken: reviewerCredential.token,
    },
  );
  assertCanonicalHiddenNotFound(
    deniedCompanyFile,
    "PREVIEW_KNOWLEDGE_COMPANY_FILE_READ_DENIAL_INVALID",
  );
  console.log("PREVIEW_KNOWLEDGE_PRIVATE_FILE_SMOKE_OK");

  const feedback = await api(`/api/knowledge/${hotelKnowledgeId}/feedback`, {
    body: { comment: null, kind: "HELPFUL", version: hotelEntry.version },
    failureCode: "PREVIEW_KNOWLEDGE_FEEDBACK_INVALID",
    idempotencyKey: stableUuid("feedback-helpful"),
    method: "POST",
  });
  if (feedback?.feedback?.kind !== "HELPFUL")
    throw new Error("PREVIEW_KNOWLEDGE_FEEDBACK_READBACK_INVALID");
  hotelEntry = await transition(
    hotelKnowledgeId,
    hotelEntry,
    "MARK_NEEDS_REVIEW",
    "현장 절차 변경으로 재검토가 필요합니다.",
    reviewerCredential,
    "MARK_NEEDS_REVIEW",
  );
  const updated = await api(`/api/knowledge/${hotelKnowledgeId}`, {
    body: {
      ...content("HOTEL", updatedTitle),
      reason: "필터 확인순서를 보완합니다.",
      version: hotelEntry.version,
    },
    failureCode: "PREVIEW_KNOWLEDGE_UPDATE_INVALID",
    idempotencyKey: stableUuid("update"),
    method: "PATCH",
  });
  hotelEntry = updated.entry;
  hotelEntry = await transition(
    hotelKnowledgeId,
    hotelEntry,
    "REQUEST_REVIEW",
    "보완된 절차 검토를 요청합니다.",
    authorCredential,
    "REREQUEST_REVIEW",
  );
  hotelEntry = await transition(
    hotelKnowledgeId,
    hotelEntry,
    "REPUBLISH",
    "보완된 절차를 독립 검토했습니다.",
    reviewerCredential,
    "REPUBLISH",
  );
  companyEntry = await transition(
    companyKnowledgeId,
    companyEntry,
    "MARK_NEEDS_REVIEW",
    "회사 공통 절차 변경으로 재검토가 필요합니다.",
    reviewerCredential,
    "COMPANY_MARK_NEEDS_REVIEW",
  );
  const updatedCompany = await api(`/api/knowledge/${companyKnowledgeId}`, {
    body: {
      ...content("COMPANY", `${companyTitle} 보완`),
      summary: `${fullToken} 회사 공통 검증 자료를 보완했습니다.`,
      reason: "회사 공통 절차 변경사항을 반영합니다.",
      version: companyEntry.version,
    },
    failureCode: "PREVIEW_KNOWLEDGE_COMPANY_UPDATE_INVALID",
    idempotencyKey: stableUuid("company-update"),
    method: "PATCH",
  });
  companyEntry = updatedCompany.entry;
  if (
    companyEntry?.status !== "NEEDS_REVIEW" ||
    companyEntry.title !== `${companyTitle} 보완`
  )
    throw new Error("PREVIEW_KNOWLEDGE_COMPANY_UPDATE_READBACK_INVALID");
  companyEntry = await transition(
    companyKnowledgeId,
    companyEntry,
    "REQUEST_REVIEW",
    "보완된 회사 공통 절차 검토를 요청합니다.",
    authorCredential,
    "COMPANY_REREQUEST_REVIEW",
  );
  companyEntry = await transition(
    companyKnowledgeId,
    companyEntry,
    "REPUBLISH",
    "보완된 회사 공통 절차를 독립 검토했습니다.",
    reviewerCredential,
    "COMPANY_REPUBLISH",
  );

  const [readback] = await ownerSql`
    select entry.status,entry.version,
      (select count(*)::int from public.hotel_knowledge_versions version where version.company_id=entry.company_id and version.knowledge_id=entry.id) as version_count,
      (select count(*)::int from public.hotel_knowledge_attachments attachment where attachment.company_id=entry.company_id and attachment.knowledge_id=entry.id) as attachment_count,
      exists(select 1 from public.audit_events audit where audit.company_id=entry.company_id and audit.resource_id=entry.id and audit.event_code='KNOWLEDGE_PUBLISH' and audit.result='SUCCEEDED') as publish_audit
    from public.hotel_knowledge_entries entry where entry.company_id=${authorPrincipal.company_id}::uuid and entry.id=${hotelKnowledgeId}::uuid`;
  if (
    readback?.status !== "PUBLISHED" ||
    readback.version !== hotelEntry.version ||
    readback.version_count < 8 ||
    readback.attachment_count !== 1 ||
    !readback.publish_audit
  )
    throw new Error("PREVIEW_KNOWLEDGE_DATABASE_READBACK_INVALID");
  console.log("PREVIEW_KNOWLEDGE_API_DB_SMOKE_OK");

  failureStage = "UI";
  browser = await chromium.launch({ headless: true });
  await verifyUi({ width: 1440, height: 1000 }, "PC");
  await verifyUi({ width: 390, height: 844 }, "MOBILE");
  console.log("PREVIEW_KNOWLEDGE_UI_SMOKE_OK");

  hotelEntry = await transition(
    hotelKnowledgeId,
    hotelEntry,
    "ARCHIVE",
    "Preview canary 검증 완료 후 보관합니다.",
    reviewerCredential,
    "ARCHIVE",
  );
  companyEntry = await transition(
    companyKnowledgeId,
    companyEntry,
    "ARCHIVE",
    "Preview 회사 공통 canary 검증 완료 후 보관합니다.",
    reviewerCredential,
    "COMPANY_ARCHIVE",
  );
  highRiskEntry = await transition(
    highRiskKnowledgeId,
    highRiskEntry,
    "ARCHIVE",
    "Preview 고위험 canary 검증 완료 후 보관합니다.",
    reviewerCredential,
    "HIGH_RISK_ARCHIVE",
  );
  if (
    hotelEntry.status !== "ARCHIVED" ||
    companyEntry.status !== "ARCHIVED" ||
    highRiskEntry.status !== "ARCHIVED"
  )
    throw new Error("PREVIEW_KNOWLEDGE_ARCHIVE_READBACK_INVALID");
  await verifyCompanyLifecycle(companyFileVersionId);
  const [lifecycleReadback] = await ownerSql`
    select entry.status,
      (select jsonb_agg(jsonb_build_object(
        'version',version.entry_version,'action',version.action,'status',version.status,
        'actorUserId',version.actor_user_id,
        'attachmentFileVersionIds',version.snapshot->'attachmentFileVersionIds'
      ) order by version.entry_version)
       from public.hotel_knowledge_versions version
       where version.company_id=entry.company_id and version.knowledge_id=entry.id) as versions,
      (select jsonb_agg(jsonb_build_object('eventCode',audit.event_code,'actorUserId',audit.actor_user_id,'result',audit.result) order by audit.created_at,audit.id)
       from public.audit_events audit
       where audit.company_id=entry.company_id and audit.resource_id=entry.id
         and audit.event_code in('KNOWLEDGE_CREATE','KNOWLEDGE_ATTACHMENTS_UPDATE','KNOWLEDGE_REQUEST_REVIEW','KNOWLEDGE_PUBLISH','KNOWLEDGE_MARK_NEEDS_REVIEW','KNOWLEDGE_UPDATE','KNOWLEDGE_REPUBLISH','KNOWLEDGE_ARCHIVE')) as audits,
      (select count(*)::int from public.idempotency_records receipt
        where receipt.company_id=entry.company_id and receipt.actor_user_id=${authorUserId}::uuid
          and receipt.idempotency_key=${stableUuid("attachment-link:hotel")} and receipt.http_method='PUT'
          and receipt.operation_path=${`/api/knowledge/${hotelKnowledgeId}/attachments`}
          and receipt.status='COMPLETED' and receipt.resource_id=entry.id) as attachment_receipt_count
    from public.hotel_knowledge_entries entry
    where entry.company_id=${authorPrincipal.company_id}::uuid and entry.id=${hotelKnowledgeId}::uuid`;
  const expectedActions = [
    "CREATE",
    "ATTACHMENTS_UPDATE",
    "REQUEST_REVIEW",
    "PUBLISH",
    "MARK_NEEDS_REVIEW",
    "UPDATE",
    "REQUEST_REVIEW",
    "REPUBLISH",
    "ARCHIVE",
  ];
  const expectedStatuses = [
    "DRAFT",
    "DRAFT",
    "REVIEW_REQUESTED",
    "PUBLISHED",
    "NEEDS_REVIEW",
    "NEEDS_REVIEW",
    "REVIEW_REQUESTED",
    "PUBLISHED",
    "ARCHIVED",
  ];
  const expectedActors = [
    authorUserId,
    authorUserId,
    authorUserId,
    reviewerUserId,
    reviewerUserId,
    authorUserId,
    authorUserId,
    reviewerUserId,
    reviewerUserId,
  ];
  if (
    lifecycleReadback?.status !== "ARCHIVED" ||
    lifecycleReadback.attachment_receipt_count !== 1 ||
    lifecycleReadback.audits?.length !== expectedActions.length ||
    lifecycleReadback.versions?.length !== expectedActions.length ||
    !lifecycleReadback.versions.every(
      (version, index) =>
        version.version === index + 1 &&
        version.action === expectedActions[index] &&
        version.status === expectedStatuses[index] &&
        version.actorUserId === expectedActors[index] &&
        Array.isArray(version.attachmentFileVersionIds) &&
        (index === 0
          ? version.attachmentFileVersionIds.length === 0
          : version.attachmentFileVersionIds.length === 1 &&
            version.attachmentFileVersionIds[0] === hotelFileVersionId),
    ) ||
    !lifecycleReadback.audits.every(
      (audit, index) =>
        audit.eventCode === `KNOWLEDGE_${expectedActions[index]}` &&
        audit.actorUserId === expectedActors[index] &&
        audit.result === "SUCCEEDED",
    )
  )
    throw new Error("PREVIEW_KNOWLEDGE_LIFECYCLE_DATABASE_READBACK_INVALID");
  console.log(`PREVIEW_KNOWLEDGE_${phase}_SMOKE_OK`);
} catch (error) {
  const code =
    error instanceof Error &&
    /^PREVIEW_KNOWLEDGE_[A-Z0-9_]+$/u.test(error.message)
      ? error.message
      : `PREVIEW_KNOWLEDGE_FAILED_${failureStage}`;
  console.error(code);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => undefined);
  const cleanupFixtureUserIds = [
    authorUserId,
    reviewerUserId,
    isolationUserId,
  ].filter(Boolean);
  if (cleanupFixtureUserIds.length) {
    try {
      await cleanupFixtureAuthority(cleanupFixtureUserIds);
    } catch {
      console.error("PREVIEW_KNOWLEDGE_CLEANUP_GRANTS_FAILED");
      process.exitCode = 1;
    }
  }
  for (const tokenHash of sessionHashes) {
    try {
      await revokeAndVerifySession(tokenHash);
    } catch {
      console.error("PREVIEW_KNOWLEDGE_CLEANUP_SESSION_FAILED");
      process.exitCode = 1;
    }
  }
  await ownerSql.end({ timeout: 5 }).catch(() => undefined);
  await sql.end({ timeout: 5 }).catch(() => undefined);
}
