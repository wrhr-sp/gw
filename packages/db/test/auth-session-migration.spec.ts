import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL("../migrations/0002_auth_session_runtime.sql", import.meta.url);

function readMigration() {
  return readFileSync(migrationUrl, "utf8");
}

describe("0002 auth session runtime migration", () => {
  it("stores only hashes for OAuth state, browser binding and nonce", () => {
    const sql = readMigration();
    expect(sql).toMatch(/state_hash\s+bytea\s+not null\s+unique/i);
    expect(sql).toMatch(/browser_binding_hash\s+bytea\s+not null/i);
    expect(sql).toMatch(/nonce_hash\s+bytea\s+not null/i);
    expect(sql).not.toMatch(/\bstate_token\b/i);
    expect(sql).not.toMatch(/\bnonce\s+text\b/i);
  });

  it("indexes expiring login transactions for bounded cleanup", () => {
    const sql = readMigration();
    expect(sql).toMatch(/expires_at\s*>\s*created_at/i);
    expect(sql).toMatch(/expires_at\s*<=\s*created_at\s*\+\s*interval\s*'10 minutes'/i);
    expect(sql).toContain("auth_login_transactions_expiry_idx");
    expect(sql).toContain("(expires_at, created_at)");
    expect(sql).toContain("auth_login_transactions_created_idx");
    expect(sql).toContain("(created_at)");
    expect(sql).not.toMatch(/consumed_at/i);
  });

  it("stores the PKCE verifier only as versioned AES-GCM ciphertext", () => {
    const sql = readMigration();
    expect(sql).toMatch(/code_verifier_ciphertext\s+bytea\s+not null/i);
    expect(sql).toMatch(/code_verifier_iv\s+bytea\s+not null/i);
    expect(sql).toMatch(/encryption_key_version\s+integer\s+not null/i);
    expect(sql).not.toMatch(/\bcode_verifier\s+text\b/i);
    expect(sql).toMatch(/octet_length\(code_verifier_iv\) = 12/i);
  });

  it("enforces the approved session lifetime upper bounds", () => {
    const sql = readMigration();
    expect(sql).toContain("idle_expires_at <= last_seen_at + interval '8 hours'");
    expect(sql).toContain("idle_expires_at <= absolute_expires_at");
    expect(sql).toContain("absolute_expires_at <= created_at + interval '24 hours'");
  });
});
