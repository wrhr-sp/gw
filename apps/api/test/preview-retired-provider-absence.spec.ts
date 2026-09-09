import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const workflow = readFileSync(resolve(root, ".github/workflows/preview-release.yml"), "utf8");

const script = resolve(root, "scripts/verify-preview-retired-provider-absence.mjs");
const { assertProviderAbsent, assertSecretsAbsent, verifyRetiredProviderAbsence } = await import(pathToFileURL(script).href);

describe("non-destructive Preview retired provider gate", () => {
  it.each([undefined, {}, { provider_removed: false, provider_relation_count: 0 }, { provider_removed: true, provider_relation_count: 1 }, { provider_removed: true, provider_relation_count: "0" }])("rejects unproven DB absence %j", (state) => {
    expect(() => assertProviderAbsent(state)).toThrow();
  });
  it("accepts only removed schema and no residual relation", () => {
    expect(() => assertProviderAbsent({ provider_removed: true, provider_relation_count: 0 })).not.toThrow();
  });
  it.each(["GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET", "CALENDAR_CREDENTIAL_AES_KEYRING_JSON", "CALENDAR_FINGERPRINT_HMAC_KEYRING_JSON", "FILE_PROCESSOR_SHARED_SECRET"])("blocks each retired key: %s", (name) => {
    expect(() => assertSecretsAbsent({ success: true, errors: [], result: [{ name, type: "secret_text" }] })).toThrow("PREVIEW_RETIRED_PROVIDER_REMAINS");
  });
  it.each([{}, { success: false, errors: [], result: [] }, { success: true, errors: [], result: [null] }, { success: true, errors: [], result: [{ name: "x", type: "unknown" }] }, { success: true, errors: [], result: [], result_info: { page: 1, total_pages: 2, total_count: 1 } }])("rejects invalid or incomplete provider envelope %j", (body) => {
    expect(() => assertSecretsAbsent(body)).toThrow();
  });
  it("uses a read-only transaction and GET-only canonical Worker endpoints", async () => {
    const query = vi.fn().mockResolvedValue([{ provider_removed: true, provider_relation_count: 0 }]);
    const begin = vi.fn(async (mode: string, callback: (tx: typeof query) => Promise<unknown>) => { expect(mode).toBe("read only"); return callback(query); });
    const end = vi.fn().mockResolvedValue(undefined);
    const connect = vi.fn(() => ({ begin, end }));
    const fetcher = vi.fn(async () => Response.json({ success: true, errors: [], result: [] }));
    await verifyRetiredProviderAbsence({ databaseUrl: "test-only", accountId: "a".repeat(32), apiToken: "test-only", connect, fetcher });
    expect(connect.mock.calls).toHaveLength(1);
    expect(query.mock.calls).toHaveLength(1);
    expect(fetcher.mock.calls).toHaveLength(2);
    for (const call of fetcher.mock.calls as unknown as [string, RequestInit][]) {
      expect(call[0]).toMatch(/^https:\/\/api.cloudflare.com\/client\/v4\/accounts\/a{32}\/workers\/scripts\/werehere-hotel-(api|account-reconciler)-preview\/secrets$/);
      expect(call[1].method).toBe("GET");
      expect(call[1].redirect).toBe("error");
      expect(call[1].body).toBeUndefined();
    }
    expect(end).toHaveBeenCalled();
  });
  it("does not disclose missing configuration through the real CLI", () => {
    const result = spawnSync(process.execPath, [script], { encoding: "utf8", env: { PATH: process.env.PATH, DATABASE_URL_PREVIEW: "private-sentinel" } });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim()).toBe("PREVIEW_RETIRED_PROVIDER_CHECK_FAILED");
    expect(result.stderr).not.toContain("private-sentinel");
  });
  it.runIf(Boolean(process.env.PREVIEW_ABSENCE_LOCAL_TEST_URL))("rejects every residual relation on real local PostgreSQL without changing it", async () => {
    const url = process.env.PREVIEW_ABSENCE_LOCAL_TEST_URL!;
    const parsed = new URL(url);
    expect(parsed.searchParams.get("host")).toMatch(/^\/home\/wrhrgw\/gw\/\.seal-replay\/absence-pg-/);
    const { createRequire } = await import("node:module");
    const postgres = createRequire(resolve(root, "packages/db/package.json"))("postgres");
    const local = { host: parsed.searchParams.get("host"), username: parsed.username, database: "postgres", port: 5432 };
    const admin = postgres({ ...local, max: 1 });
    const fetcher = vi.fn(async () => Response.json({ success: true, errors: [], result: [] }));
    const input = { databaseUrl: url, accountId: "a".repeat(32), apiToken: "test-only", fetcher };
    const connect = (value: string, options: Record<string, unknown>) => {
      expect(value).toBe(url);
      const sql = postgres({ ...options, ...local });
      const begin = sql.begin.bind(sql);
      sql.begin = (mode: string, callback: (tx: unknown) => Promise<unknown>) => begin(mode, async (tx: ReturnType<typeof postgres>) => {
        const [state] = await tx`show transaction_read_only`;
        expect(state.transaction_read_only).toBe("on");
        return callback(tx);
      });
      return sql;
    };
    try {
      await admin`create table schema_migrations(version text primary key)`;
      await expect(verifyRetiredProviderAbsence({ ...input, connect })).rejects.toThrow("PREVIEW_RETIRED_PROVIDER_REMAINS");
      expect(fetcher).not.toHaveBeenCalled();
      await admin`insert into schema_migrations values ('0045_remove_google_calendar_projection')`;
      await verifyRetiredProviderAbsence({ ...input, connect });
      expect(fetcher).toHaveBeenCalledTimes(2);
      for (const name of ["calendar_connections", "calendar_connection_credentials", "calendar_oauth_transactions", "calendar_hotel_links", "calendar_event_links", "calendar_projection_jobs", "calendar_projection_attempts", "calendar_sync_failures", "calendar_catch_up_items", "calendar_crypto_settings"]) {
        await admin.unsafe(`create table ${name}(id integer)`);
        fetcher.mockClear();
        await expect(verifyRetiredProviderAbsence({ ...input, connect })).rejects.toThrow("PREVIEW_RETIRED_PROVIDER_REMAINS");
        expect(fetcher).not.toHaveBeenCalled();
        const [state] = await admin`select to_regclass(${name}) is not null as retained`;
        expect(state.retained).toBe(true);
        await admin.unsafe(`drop table ${name}`);
      }
      const rows = await admin`select version from schema_migrations`;
      expect(rows).toHaveLength(1);
    } finally { await admin.end(); }
  });
  it("runs before bootstrap and database mutation and removes all release deletion paths", () => {
    const gate = workflow.indexOf("- name: Verify retired Preview provider absence before mutation");
    expect(gate).toBeGreaterThan(0);
    expect(gate).toBeLessThan(workflow.indexOf("- name: Verify approved ZITADEL bootstrap identity"));
    expect(workflow).not.toContain("node scripts/decommission-google-calendar-preview.mjs");
    expect(workflow).not.toContain("wrangler secret delete");
    expect(workflow).not.toContain("disposition_started=true");
    expect(workflow.match(/node scripts\/verify-preview-retired-provider-absence.mjs/g)).toHaveLength(3);
  });
});
