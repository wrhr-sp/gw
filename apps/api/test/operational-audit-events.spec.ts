import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(new URL("../../../db/postgres/migrations/0009_audit_privacy_file_access_logs.sql", import.meta.url), "utf8").toLowerCase();
const downloadTicketMigrationSql = readFileSync(new URL("../../../db/postgres/migrations/0010_document_file_download_tickets.sql", import.meta.url), "utf8").toLowerCase();
const auditHelperSource = readFileSync(new URL("../src/lib/operational-audit-events.ts", import.meta.url), "utf8");
const downloadTicketSource = readFileSync(new URL("../src/lib/operational-document-download-tickets.ts", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
const permissionSource = readFileSync(new URL("../src/lib/operational-admin-permissions.ts", import.meta.url), "utf8");

describe("operational audit, privacy, and file access standards", () => {
  it("defines dedicated PostgreSQL tables and indexes for privacy, file, and permission audit events", () => {
    expect(migrationSql).toContain("create table if not exists privacy_access_logs");
    expect(migrationSql).toContain("create table if not exists file_access_logs");
    expect(migrationSql).toContain("create table if not exists permission_change_logs");
    expect(migrationSql).toContain("idx_privacy_access_logs_subject_created_at");
    expect(migrationSql).toContain("idx_file_access_logs_file_created_at");
    expect(migrationSql).toContain("idx_permission_change_logs_role_created_at");
    expect(downloadTicketMigrationSql).toContain("create table if not exists document_file_download_tickets");
    expect(downloadTicketMigrationSql).toContain("token_hash text not null unique");
    expect(downloadTicketMigrationSql).toContain("used_at timestamptz");
  });

  it("records document file mutations and downloads through the shared audit event helper", () => {
    expect(auditHelperSource).toContain("recordOperationalFileAccessEvent");
    expect(auditHelperSource).toContain("recordOperationalPrivacyAccessEvent");
    expect(appSource).toContain('action: "document.file.upload_init"');
    expect(appSource).toContain('action: "document.file.upload_complete"');
    expect(appSource).toContain('action: "document.file.download_init"');
    expect(appSource).toContain('action: "document.file.delete"');
    expect(appSource).toContain('accessType: "download"');
    expect(appSource).toContain("contentBase64");
    expect(appSource).toContain("putObject");
    expect(appSource).toContain("DOCUMENT_FILE_DOWNLOAD_ROUTE");
    expect(appSource).toContain("createOperationalDocumentDownloadTicket");
    expect(appSource).toContain("consumeOperationalDocumentDownloadTicket");
    expect(downloadTicketSource).toContain("hashDocumentDownloadToken");
  });

  it("records integrated-settings permission changes as structured permission change events", () => {
    expect(auditHelperSource).toContain("recordOperationalPermissionChangeEvent");
    expect(permissionSource).toContain("recordOperationalPermissionChangeEvent");
    expect(permissionSource).toContain('reason: "통합설정 권한 범위 변경"');
    expect(permissionSource).toContain("targetFeatureKey: featureKey");
  });
});
