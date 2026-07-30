import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../migrations/0027_hotel_file_api_storage_access.sql",
  import.meta.url,
);
const repositoryUrl = new URL("../src/hotel-files.ts", import.meta.url);
const readinessUrl = new URL("../src/client.ts", import.meta.url);

function readOptional(url: URL): string {
  return existsSync(fileURLToPath(url)) ? readFileSync(url, "utf8") : "";
}

function commandSource(sql: string, name: string): string {
  const match = sql.match(
    new RegExp(
      `create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${name}\\b([\\s\\S]*?)\\$function\\$;`,
      "iu",
    ),
  );
  return match?.[0] ?? "";
}

describe("0027 hotel file API storage/access security contract", () => {
  it("adds a five-minute, creator-session-bound upload authority", () => {
    const sql = readOptional(migrationUrl);
    expect(sql).toContain("0027_hotel_file_api_storage_access");
    expect(sql).toMatch(/initiated_session_id\s+uuid/iu);
    expect(sql).toMatch(/reservation_fingerprint\s+text/iu);
    expect(sql).toMatch(/interval\s+'5 minutes'/iu);

    const init = commandSource(sql, "hotel_file_init_upload_v2");
    expect(init).toContain("HOTEL_FILE_UPLOAD");
    expect(init).toContain("permission_grants");
    expect(init).toContain("DENY");
    expect(init).toContain("initiated_session_id");
    expect(init).toContain("p_ttl_seconds");
    expect(init).toContain("expires_at");
    expect(init).toContain("pg_advisory_xact_lock");
    expect(init).toContain("p_idempotency_key");

    const authorize = commandSource(sql, "hotel_file_authorize_upload_body_v1");
    for (const required of [
      "initiated_by",
      "initiated_session_id",
      "PENDING_UPLOAD",
      "expires_at",
      "quarantine_object_key",
      "reserved_size_bytes",
      "declared_mime_type",
      "reservation_fingerprint",
      "HOTEL_FILE_UPLOAD",
    ]) {
      expect(authorize).toContain(required);
    }
  });

  it("hardens complete and status against same-company upload UUID access", () => {
    const sql = readOptional(migrationUrl);
    const complete = commandSource(sql, "hotel_file_complete_upload_v2");
    expect(complete).toContain("initiated_by");
    expect(complete).toContain("initiated_session_id");
    expect(complete).toContain("HOTEL_FILE_UPLOAD");
    expect(complete).toContain("QUARANTINED");
    expect(complete).toContain("REPLAYED");

    const status = commandSource(sql, "hotel_file_read_status_v2");
    expect(status).toContain("initiated_by");
    expect(status).toContain("HOTEL_FILE_READ");
    expect(status).toContain("updated_at");
    expect(status).toContain("NOT_FOUND");
    expect(status).toContain("v_upload.state");
    expect(status).not.toMatch(/when\s+v_upload\.state[\s\S]*then\s+'PENDING_UPLOAD'/iu);
  });

  it("stores only hashed short access grants and rechecks LINKED CLEAN access", () => {
    const sql = readOptional(migrationUrl);
    expect(sql).toMatch(/create\s+table\s+public\.hotel_file_access_grants/iu);
    expect(sql).toMatch(/grant_token_hash\s+bytea/iu);
    expect(sql).not.toMatch(/raw_(?:grant|access)_token/iu);

    const issue = commandSource(sql, "hotel_file_issue_access_grant_v1");
    for (const required of [
      "hotel_file_links",
      "hotel_file_versions",
      "LINKED",
      "HOTEL_FILE_READ",
      "HOTEL_FILE_DOWNLOAD",
      "p_grant_id",
      "HOTEL_FILE_ACCESS_DENIED",
      "DENY",
      "p_ttl_seconds",
      "grant_token_hash",
      "HOTEL_FILE_ACCESS_DENIED",
    ]) {
      expect(issue).toContain(required);
    }

    const resolve = commandSource(sql, "hotel_file_resolve_access_grant_v1");
    for (const required of [
      "grant_token_hash",
      "session_id",
      "expires_at",
      "hotel_file_links",
      "LINKED",
      "clean_object_key",
      "destination_etag",
      "destination_object_version",
      "sha256",
      "HOTEL_FILE_READ",
      "HOTEL_FILE_DOWNLOAD",
      "p_grant_id",
      "HOTEL_FILE_ACCESS_DENIED",
    ]) {
      expect(resolve).toContain(required);
    }
    expect(commandSource(sql, "hotel_file_record_access_outcome_v1")).toContain(
      "audit_events",
    );
    expect(commandSource(sql, "hotel_file_record_access_outcome_v1")).toContain(
      "v_grant.last_outcome=p_outcome",
    );
    expect(commandSource(sql, "hotel_file_record_access_outcome_v1")).toContain(
      "v_grant.last_outcome is null and p_outcome<>'STARTED'",
    );
    expect(commandSource(sql, "hotel_file_record_access_denial_v1")).toContain(
      "HOTEL_FILE_ACCESS_DENIED",
    );
    const identityGuard = commandSource(
      sql,
      "reject_hotel_file_access_grant_identity_change",
    );
    for (const protectedColumn of [
      "id",
      "company_id",
      "branch_id",
      "parent_type",
      "parent_id",
      "file_version_id",
      "issued_by",
      "issued_by_type",
      "session_id",
      "grant_token_hash",
      "disposition",
      "expires_at",
      "issued_at",
    ]) {
      expect(identityGuard).toContain(`new.${protectedColumn}`);
      expect(identityGuard).toContain(`old.${protectedColumn}`);
    }
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.reject_hotel_file_access_grant_identity_change\(\)\s+from\s+public/iu,
    );
    expect(sql).toMatch(
      /create\s+trigger\s+hotel_file_access_grants_identity_immutable[\s\S]*before\s+update\s+of[\s\S]*issued_by_type[\s\S]*grant_token_hash[\s\S]*on\s+public\.hotel_file_access_grants/iu,
    );
    expect(sql).toContain("'STARTED'");
  });

  it("exposes only command EXECUTE authority to API runtime", () => {
    const sql = readOptional(migrationUrl);
    expect(sql).toContain(
      "grant werehere_hotel_file_api_definer to %I with inherit false, set true",
    );
    expect(sql).toContain(
      "revoke werehere_hotel_file_api_definer from %I granted by %I",
    );
    expect(sql).toContain("issued_by_type text not null");
    expect(sql).toContain("v_actor.user_id,v_actor.user_type,v_actor.session_id");
    expect(sql).toContain("v_grant.issued_by,v_grant.issued_by_type");
    expect(sql).not.toContain("v_user.user_id,v_user.user_type");
    expect(sql).toMatch(/create\s+policy\s+hotel_file_api_terminal_audit_insert[\s\S]*for\s+insert[\s\S]*to\s+werehere_hotel_file_api_definer[\s\S]*HOTEL_FILE_ACCESS_OUTCOME_RECORDED[\s\S]*HOTEL_FILE_ACCESS_GRANT/iu);
    expect(sql).toMatch(/revoke\s+all\s+on\s+table\s+public\.hotel_file_access_grants\s+from\s+public/iu);
    expect(sql).toMatch(/revoke\s+execute[\s\S]*hotel_file_init_upload\([\s\S]*from\s+werehere_api_runtime/iu);
    for (const command of [
      "hotel_file_init_upload_v2",
      "hotel_file_authorize_upload_body_v1",
      "hotel_file_complete_upload_v2",
      "hotel_file_read_status_v2",
      "hotel_file_issue_access_grant_v1",
      "hotel_file_resolve_access_grant_v1",
      "hotel_file_record_access_outcome_v1",
      "hotel_file_record_access_denial_v1",
    ]) {
      expect(sql).toMatch(
        new RegExp(`grant\\s+execute[\\s\\S]*${command}`, "iu"),
      );
    }
    expect(sql).not.toMatch(
      /grant\s+(?:select|insert|update|delete)[\s\S]*hotel_file_access_grants[\s\S]*werehere_api_runtime/iu,
    );
  });

  it("wires the v2 commands into the typed Repository and readiness gate", () => {
    const repository = readOptional(repositoryUrl);
    const readiness = readOptional(readinessUrl);
    for (const command of [
      "hotel_file_init_upload_v2",
      "hotel_file_authorize_upload_body_v1",
      "hotel_file_complete_upload_v2",
      "hotel_file_read_status_v2",
      "hotel_file_issue_access_grant_v1",
      "hotel_file_resolve_access_grant_v1",
      "hotel_file_record_access_outcome_v1",
      "hotel_file_record_access_denial_v1",
    ]) {
      expect(repository).toContain(command);
      expect(readiness).toContain(command);
    }
    expect(repository).not.toMatch(
      /(?:objectKey|cleanObjectKey|reservationFingerprint).*hotelFileStatusSchema/iu,
    );
    expect(readiness).toContain("hotel_file_uploads_v2_authority_immutable");
    expect(readiness).toContain("hotel_file_access_grants_definer_only");
    expect(readiness).toMatch(/FILE_RLS_TABLES[\s\S]*hotel_file_access_grants/iu);
    expect(readiness).toMatch(/table_record\.relname\s+in\s*\([\s\S]*hotel_file_access_grants/iu);
    expect(readiness).toContain("approvedHotelFileTriggers");
    expect(readiness).toContain("hotel_file_access_grants_user_rate_idx");
    expect(readiness).toContain("hotel_file_access_grants_branch_rate_idx");
  });
});
