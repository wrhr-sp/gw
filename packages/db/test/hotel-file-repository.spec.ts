import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../src/hotel-files.ts", import.meta.url),
  "utf8",
);
const indexSource = readFileSync(
  new URL("../src/index.ts", import.meta.url),
  "utf8",
);

function methodSource(name: string, nextName: string) {
  const start = source.indexOf(`async ${name}`);
  const end = source.indexOf(`async ${nextName}`, start);
  expect(start, `${name} must be implemented`).toBeGreaterThanOrEqual(0);
  expect(end, `${name} must end before ${nextName}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("hotel file Repository source contract", () => {
  it("exports separate API, scanner, and finalizer interfaces and PostgreSQL factories", () => {
    for (const contract of [
      "export interface HotelFileApiRepository",
      "export interface HotelFileScannerRepository",
      "export interface HotelFileFinalizerRepository",
      "export function createPostgresHotelFileApiRepository",
      "export function createPostgresHotelFileScannerRepository",
      "export function createPostgresHotelFileFinalizerRepository",
    ]) {
      expect(source).toContain(contract);
      expect(indexSource).toContain(
        contract.replace(/^export (?:interface|function) /u, ""),
      );
    }
  });

  it("publishes closed result unions for every lifecycle boundary", () => {
    for (const resultType of [
      "InitHotelFileUploadResult",
      "CompleteHotelFileUploadResult",
      "ClaimHotelFileScanResult",
      "CompleteHotelFileScanResult",
      "ReserveHotelFileCleanPromotionResult",
      "CompleteHotelFileCleanPromotionResult",
      "LinkHotelFileResult",
      "HotelFileStatusResult",
    ]) {
      expect(source).toContain(`export type ${resultType} =`);
      expect(indexSource).toContain(`type ${resultType}`);
    }
    for (const status of [
      "CREATED",
      "REPLAYED",
      "IDEMPOTENCY_CONFLICT",
      "FORBIDDEN",
      "NOT_FOUND",
      "BUSY",
      "CLAIMED",
      "STALE_FENCE",
      "LEASE_EXPIRED",
      "COMPLETION_CONFLICT",
      "RETRY_SCHEDULED",
      "DEAD_LETTERED",
      "VERSION_CONFLICT",
      "READY_UNLINKED",
      "LINKED",
    ]) {
      expect(source).toContain(`"${status}"`);
    }
  });

  it("uses command functions rather than direct file-table DML", () => {
    for (const command of [
      "hotel_file_init_upload",
      "hotel_file_complete_upload",
      "hotel_file_claim_scan_attempt",
      "hotel_file_complete_scan_attempt",
      "hotel_file_reserve_clean_promotion",
      "hotel_file_complete_clean_promotion",
      "hotel_file_link_clean_version",
      "hotel_file_read_status",
    ]) {
      expect(source).toContain(command);
    }
    expect(source).not.toMatch(
      /(?:insert\s+into|update|delete\s+from)\s+(?:public\.)?(?:hotel_file_|file_scan_attempts)/iu,
    );
  });

  it("generates a raw claim token only in scanner memory and lets PostgreSQL digest it", () => {
    expect(source).toContain('randomBytes(32).toString("base64url")');
    expect(source).not.toContain("claim_token_hash");
    expect(source).not.toMatch(/console\.(?:debug|info|log|warn|error)/u);
    expect(source).not.toMatch(
      /JSON\.stringify\([^)]*(?:claimToken|rawToken)/isu,
    );
    expect(source).not.toMatch(
      /(?:idempotency|audit|payload)[\s\S]{0,160}(?:claimToken|rawToken)/iu,
    );
  });

  it("binds CLEAN promotion to an in-memory raw token, generation, lease, and detected MIME", () => {
    const reserve = methodSource(
      "reserveCleanPromotion",
      "completeCleanPromotion",
    );
    expect(reserve).toContain('randomBytes(32).toString("base64url")');
    expect(reserve).toContain("fileVersionId");
    expect(reserve).toContain("promotionToken");
    expect(reserve).toContain("leaseSeconds");
    expect(reserve).toContain("detectedMimeType");

    const complete = methodSource("completeCleanPromotion", "close");
    expect(complete).toContain("promotionGeneration");
    expect(complete).toContain("promotionToken");
    expect(complete).toContain("destinationMimeType");
    expect(complete).toContain("parseUploadState");
  });

  it("passes immutable source evidence through scan and CLEAN finalization", () => {
    const claim = methodSource("claimScan", "completeScan");
    expect(claim).toContain("sourceEtag");
    expect(claim).toContain("sourceObjectVersion");

    const completion = methodSource("completeScan", "close");
    expect(completion).toContain("actualSizeBytes");
    expect(completion).toContain("sha256");
    expect(completion).toContain("claimGeneration");
    expect(completion).toContain("claimToken");

    const reserve = methodSource(
      "reserveCleanPromotion",
      "completeCleanPromotion",
    );
    expect(reserve).toContain("sourceEtag");
    expect(reserve).toContain("sourceObjectVersion");
    expect(reserve).toContain("sourceSha256");

    const promote = methodSource("completeCleanPromotion", "close");
    expect(promote).toContain("destinationEtag");
    expect(promote).toContain("destinationObjectVersion");
    expect(promote).toContain("destinationSha256");
    expect(promote).toContain("destinationSizeBytes");
  });

  it("records malformed-cookie denial with session, grant, reason, and trace but no raw token", () => {
    const denial = methodSource("recordAccessDenial", "linkCleanVersion");
    expect(denial).toContain("set_config('app.session_id'");
    expect(denial).toContain("hotel_file_record_access_denial_v1");
    expect(denial).toContain("input.grantId");
    expect(denial).toContain("input.reason");
    expect(denial).toContain("input.traceId ?? randomUUID()");
    expect(denial).not.toMatch(/grantToken|tokenHash/iu);
  });

  it("returns only committed safe status projections", () => {
    const status = methodSource("getStatus", "close");
    expect(status).toContain("hotel_file_read_status");
    expect(status).toContain("hotelFileStatusSchema.parse");
    expect(status).not.toMatch(
      /claimToken|callbackBodyHash|objectKey|objectVersion|etag|sha256|leaseExpiresAt|claimGeneration/iu,
    );
  });
});
