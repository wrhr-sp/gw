import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const smokeUrl = new URL(
  "../../../scripts/smoke-inquiries-preview.mjs",
  import.meta.url,
);
const smokePath = fileURLToPath(smokeUrl);
const source = readFileSync(smokeUrl, "utf8");
const workflow = readFileSync(
  new URL("../../../.github/workflows/preview-release.yml", import.meta.url),
  "utf8",
);

describe("hosted Preview owner-inquiry smoke", () => {
  it("verifies real API, PostgreSQL, permissions, attachments, notifications, auto-close, UI, and Axe", () => {
    expect(() =>
      execFileSync(process.execPath, ["--check", smokePath], { stdio: "pipe" }),
    ).not.toThrow();
    expect(source).toContain("auth_create_session_v2");
    expect(source).toContain("ownerCandidates.length !== 2");
    expect(source).toContain('ensureOwnerFixture("target", true)');
    expect(source).toContain('ensureOwnerFixture("isolated", false)');
    expect(source).toContain("insert into public.users");
    expect(source).toContain("insert into public.auth_identities");
    expect(source).toContain("if (assignToTarget) await tx");
    expect(source).toContain("insert into public.hotel_owner_assignments");
    expect(source).toContain("readback?.target_owner !== assignToTarget");
    expect(source).toContain("readback?.any_active_owner !== false");
    expect(source).toContain("ownerFixtureSeed");
    expect(source).toContain("on conflict(id)do nothing");
    expect(source).toContain("PREVIEW_OWNER_INQUIRY_OWNER_FIXTURE_INVALID");
    expect(source).toContain("PREVIEW_OWNER_INQUIRY_CAPABILITIES_INVALID");
    expect(source).toContain("PREVIEW_OWNER_INQUIRY_OWNER_CAPABILITY_NOT_READY");
    expect(source).toContain('failureStage = "OWNER_CAPABILITIES"');
    expect(source).not.toContain("public.hotel_inquiry_actor_v1");
    expect(source).toContain("ownerACredential.token");
    expect(source).toContain("ownerBCredential.token");
    for (const boundary of [
      "CROSS_OWNER_DETAIL_LEAK",
      "CROSS_OWNER_LIST_LEAK",
      "CROSS_OWNER_TRANSITION_LEAK",
      "CROSS_OWNER_UPLOAD_LEAK",
      "CROSS_OWNER_FILE_LEAK",
    ]) expect(source).toContain(boundary);
    expect(source).toContain(
      "ownerBUpload.response.status !== 404 || ownerBUpload.payload?.data",
    );
    expect(source).toContain("ownerBView.response.status !== 404");
    for (const boundary of [
      "FILE_VIEW_STATUS_INVALID",
      "FILE_VIEW_BODY_INVALID",
      "FILE_VIEW_MIME_INVALID",
      "FILE_VIEW_CACHE_INVALID",
      "FILE_VIEW_NOSNIFF_INVALID",
      "FILE_VIEW_DISPOSITION_INVALID",
      "FILE_VIEW_DISPOSITION_CRLF",
    ]) expect(source).toContain(boundary);
    expect(source).toContain("FILE_VIEW_LENGTH_INVALID");
    expect(source).toContain(
      "contentLength !== null && Number(contentLength) !== viewedBody.byteLength",
    );
    expect(source).toContain("insert into public.permission_grants");
    for (const permission of [
      "HOTEL_OWNER_INQUIRY_READ",
      "HOTEL_OWNER_INQUIRY_CREATE",
      "HOTEL_INQUIRY_READ",
      "HOTEL_INQUIRY_REPLY",
      "HOTEL_INQUIRY_ASSIGN",
      "HOTEL_INQUIRY_SETTINGS",
    ])
      expect(source).toContain(permission);
    for (const path of [
      "/inquiries",
      "/messages",
      "/assign",
      "/transitions",
      "/files/upload-init",
      "/body",
      "/complete",
      "/view",
    ])
      expect(source).toContain(path);
    expect(source).toContain("public.hotel_inquiries");
    expect(source).toContain("public.hotel_inquiry_messages");
    expect(source).toContain("public.hotel_inquiry_notifications");
    expect(source).toContain("public.hotel_inquiry_auto_close_v1");
    expect(source).toContain("HOTEL_INQUIRY_AUTO_CLOSE");
    expect(source).toContain("response.status !== 403");
    expect(source).toContain("PREVIEW_OWNER_INQUIRY_API_DB_SMOKE_OK");
    expect(source).toContain("PREVIEW_OWNER_INQUIRY_UI_SMOKE_OK");
    expect(source).toContain("new AxeBuilder({ page })");
    expect(source).toContain('optimizeEvidenceImage(png, "image/png")');
    expect(source).toContain('headers.get("cache-control") !== "private, no-store"');
    expect(source).toContain('headers.get("x-content-type-options") !== "nosniff"');
    expect(source).toContain("expectedContentDisposition");
    expect(source).toContain("/[\\r\\n]/u.test");
    expect(source).toContain("GITHUB_RUN_ATTEMPT");
    expect(source).toContain("completeUploadWithReplay");
    expect(source).toContain("./lib/inquiry-smoke-recovery.mjs");
    expect(source).toContain("terminalizeFailedCanary");
    expect(source).toContain("if (!createdInquiry?.present) return");
    expect(source).toContain("PREVIEW_OWNER_INQUIRY_CLEANUP_TERMINALIZATION_FAILED");
    expect(source).toContain("console.error(code)");
    expect(source).toContain("console.error(cleanupCode)");
    expect(source.indexOf("console.error(code)")).toBeLessThan(
      source.indexOf("await terminalizeFailedCanary()"),
    );
    expect(source).toContain("/^PREVIEW_OWNER_INQUIRY_CLEANUP_[A-Z0-9_]+$/u");
    expect(source).toContain("upload.status not in('LINKED','EXPIRED','REJECTED','SCAN_FAILED')");
    expect(source).toContain('getByRole("link", { name: "Preview 문의 첨부.png" })');
    expect(source).toContain("verifyUi({ width: 390, height: 844 }");
    expect(source).toContain("verifyUi({ width: 1440, height: 1000 }");
    expect(source).toContain("delete from public.permission_grants");
    expect(source).toContain("auth_revoke_session_v2");
    expect(source).not.toContain("console.error(error");
    expect(source).not.toContain("console.log(await page.content())");
  });

  it("is a mandatory pre-contract Preview release gate", () => {
    expect(workflow).toContain(
      "Verify hosted Preview owner inquiry API, DB, attachments, notifications, and responsive UI before contract",
    );
    expect(workflow).toContain(
      "pnpm exec tsx scripts/smoke-inquiries-preview.mjs | tee /tmp/preview-owner-inquiry-smoke.log",
    );
    expect(workflow).toContain(
      "grep -qx 'PREVIEW_OWNER_INQUIRY_API_DB_SMOKE_OK' /tmp/preview-owner-inquiry-smoke.log",
    );
    expect(workflow).toContain(
      "grep -qx 'PREVIEW_OWNER_INQUIRY_UI_SMOKE_OK' /tmp/preview-owner-inquiry-smoke.log",
    );
    expect(workflow.indexOf("Verify hosted Preview owner inquiry")).toBeLessThan(
      workflow.indexOf("Contract Neon Preview tenant authority"),
    );
    const ownerInquiry = workflow.indexOf("Verify hosted Preview owner inquiry");
    const exactActive = workflow.indexOf(
      "Verify exact active Workers after owner inquiry smoke and before contract",
    );
    const contract = workflow.indexOf("Contract Neon Preview tenant authority");
    expect(ownerInquiry).toBeLessThan(exactActive);
    expect(exactActive).toBeLessThan(contract);
  });

  it("re-runs the same vertical smoke after CONTRACT and exact-active Worker verification", () => {
    const postName = "Verify hosted Preview owner inquiry API, DB, R2, scanner, projections, and UI after contract";
    expect(workflow).toContain(postName);
    expect(workflow).toContain("OWNER_INQUIRY_SMOKE_PHASE: POST_CONTRACT");
    expect(workflow).toContain("PREVIEW_OWNER_INQUIRY_POST_CONTRACT_SMOKE_OK");
    const contract = workflow.indexOf("Contract Neon Preview tenant authority");
    const exactActive = workflow.indexOf("Verify exact active Workers before post-contract own Calendar smoke");
    const postInquiry = workflow.indexOf(postName);
    expect(contract).toBeLessThan(exactActive);
    expect(exactActive).toBeLessThan(postInquiry);
  });
});
