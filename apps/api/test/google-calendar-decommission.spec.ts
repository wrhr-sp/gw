import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";

type DecommissionModule = {
  parseAesKeyring(value: string): Map<number, Buffer>;
  decryptCalendarValue(
    keyring: Map<number, Buffer>,
    value: { ciphertext: Uint8Array; iv: Uint8Array; keyVersion: number },
    aad: string,
  ): Promise<string>;
  deleteMappedGoogleCalendar(input: {
    fetcher: typeof fetch;
    accessToken: string;
    calendarId: string | null;
    lookupKey: string;
  }): Promise<{ outcome: string }>;
  revokeGoogleCredential(input: {
    fetcher: typeof fetch;
    refreshCredential: string;
  }): Promise<{ outcome: string }>;
};

const scriptPath = fileURLToPath(
  new URL(
    "../../../scripts/decommission-google-calendar-preview.mjs",
    import.meta.url,
  ),
);
let subject: DecommissionModule;

beforeAll(async () => {
  subject = (await import(
    pathToFileURL(scriptPath).href
  )) as DecommissionModule;
});

async function encryptedFixture(cleartext: string, aad: string) {
  const rawKey = randomBytes(32);
  const rawKeyBytes = new Uint8Array(rawKey.byteLength);
  rawKeyBytes.set(rawKey);
  const iv = new Uint8Array(12);
  iv.set(randomBytes(12));
  const key = await crypto.subtle.importKey(
    "raw",
    rawKeyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(aad),
    },
    key,
    new TextEncoder().encode(cleartext),
  );
  return {
    keyring: new Map([[7, rawKey]]),
    value: {
      ciphertext: new Uint8Array(ciphertext),
      iv,
      keyVersion: 7,
    },
  };
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Preview Google Calendar provider disposition", () => {
  it("parses only canonical 256-bit AES key material", () => {
    const key = randomBytes(32);
    const parsed = subject.parseAesKeyring(
      JSON.stringify({ 3: key.toString("base64url") }),
    );
    expect(parsed.get(3)).toEqual(key);
    expect(() => subject.parseAesKeyring('{"3":"AA"}')).toThrow(
      "CALENDAR_KEYRING_INVALID",
    );
    expect(() => subject.parseAesKeyring("not-json")).toThrow(
      "CALENDAR_KEYRING_INVALID",
    );
  });

  it("decrypts only with the exact domain-separated AAD", async () => {
    const fixture = await encryptedFixture(
      "provider-material",
      "calendar_id|company|hotel|link|1",
    );
    await expect(
      subject.decryptCalendarValue(
        fixture.keyring,
        fixture.value,
        "calendar_id|company|hotel|link|1",
      ),
    ).resolves.toBe("provider-material");
    await expect(
      subject.decryptCalendarValue(
        fixture.keyring,
        fixture.value,
        "calendar_id|other-company|hotel|link|1",
      ),
    ).rejects.toThrow("CALENDAR_MATERIAL_DECRYPT_FAILED");
  });

  it("deletes only an exact mapped calendar and confirms 404 read-back", async () => {
    const calendarId = "gw-calendar@example.invalid";
    const description = "werehere-link:v1:opaque-lookup";
    const responses = [
      jsonResponse({ id: calendarId, description }),
      jsonResponse({ items: [{ id: calendarId, description }] }),
      new Response(null, { status: 204 }),
      new Response(null, { status: 404 }),
    ];
    const requests: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push([input, init]);
        return responses.shift() as Response;
      },
    );

    await expect(
      subject.deleteMappedGoogleCalendar({
        fetcher: fetcher as typeof fetch,
        accessToken: "ephemeral-access-token",
        calendarId,
        lookupKey: "opaque-lookup",
      }),
    ).resolves.toEqual({ outcome: "DELETED" });

    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(requests[2]?.[1]).toMatchObject({ method: "DELETE" });
    for (const [, init] of requests)
      expect(init?.headers).toMatchObject({
        authorization: "Bearer ephemeral-access-token",
      });
  });

  it("fails closed before mutation when provider metadata mismatches the DB mapping", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        id: "different-calendar@example.invalid",
        description: "unrelated-calendar",
      }),
    );
    await expect(
      subject.deleteMappedGoogleCalendar({
        fetcher: fetcher as typeof fetch,
        accessToken: "ephemeral-access-token",
        calendarId: "mapped-calendar@example.invalid",
        lookupKey: "opaque-lookup",
      }),
    ).rejects.toThrow("GOOGLE_CALENDAR_MAPPING_MISMATCH");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("classifies transport failure as outcome unknown and rejects redirects", async () => {
    await expect(
      subject.deleteMappedGoogleCalendar({
        fetcher: (async () => {
          throw new Error("network detail must not escape");
        }) as typeof fetch,
        accessToken: "ephemeral-access-token",
        calendarId: "mapped-calendar@example.invalid",
        lookupKey: "opaque-lookup",
      }),
    ).rejects.toThrow("GOOGLE_PROVIDER_OUTCOME_UNKNOWN");

    await expect(
      subject.revokeGoogleCredential({
        fetcher: (async () =>
          new Response(null, {
            status: 302,
            headers: { location: "https://untrusted.invalid" },
          })) as typeof fetch,
        refreshCredential: "ephemeral-refresh-token",
      }),
    ).rejects.toThrow("GOOGLE_PROVIDER_REDIRECT_REJECTED");
  });

  it("accepts only confirmed revoke or already-inactive provider responses", async () => {
    const requests: Array<[string, RequestInit | undefined]> = [];
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push([String(input), init]);
        return new Response(null, { status: 200 });
      },
    );
    await expect(
      subject.revokeGoogleCredential({
        fetcher: fetcher as typeof fetch,
        refreshCredential: "ephemeral-refresh-token",
      }),
    ).resolves.toEqual({ outcome: "REVOKED" });
    expect(requests[0]?.[0]).toBe("https://oauth2.googleapis.com/revoke");
    expect(requests[0]?.[0]).not.toContain("ephemeral-refresh-token");
    expect(String(requests[0]?.[1]?.body)).toBe(
      "token=ephemeral-refresh-token",
    );
    expect(requests[0]?.[1]?.headers).toMatchObject({
      "content-type": "application/x-www-form-urlencoded",
    });
    await expect(
      subject.revokeGoogleCredential({
        fetcher: (async () =>
          new Response(null, { status: 400 })) as typeof fetch,
        refreshCredential: "ephemeral-refresh-token",
      }),
    ).resolves.toEqual({ outcome: "CONFIRMED_INACTIVE" });
  });

  it("resumes only from current-row confirmed disposition receipts", () => {
    const source = readFileSync(scriptPath, "utf8");
    expect(source).toContain(
      "disposition_audit.occurred_at >= calendar_hotel_links.updated_at",
    );
    expect(source).toContain(
      "disposition_audit.occurred_at >= calendar_connection_credentials.updated_at",
    );
    expect(source).toContain(
      "link.connection_id === connection.id && !link.disposition_confirmed",
    );
    expect(source).toContain("if (credential.disposition_confirmed) continue;");
    const dispositionFunction = source.slice(
      source.indexOf("export async function runPreviewGoogleDecommission"),
      source.indexOf("async function main()"),
    );
    expect(dispositionFunction).toContain(
      "pg_catalog.hashtextextended(locked_company_id::text, 0)",
    );
    expect(dispositionFunction.indexOf("hashtextextended")).toBeLessThan(
      dispositionFunction.indexOf("providerTableLockSql"),
    );
    expect(dispositionFunction).toContain(
      "inFlight?.claimed_oauth_count !== 0",
    );
    expect(dispositionFunction).toContain(
      "GOOGLE_PROVIDER_OAUTH_OUTCOME_UNRESOLVED",
    );
    expect(dispositionFunction).toContain(
      "GOOGLE_PROVIDER_DISPOSITION_REVALIDATION_FAILED",
    );
    expect(dispositionFunction).toContain(
      'eventCode: "GOOGLE_CALENDAR_DECOMMISSION_DB_DISPOSITION_CONFIRMED"',
    );
    expect(dispositionFunction).toContain("await audit(tx, {");
    expect(dispositionFunction).toContain(
      "await tx.unsafe(googleRemovalTransactionBody())",
    );
    expect(dispositionFunction.match(/sql\.begin\(/gu)).toHaveLength(1);
    expect(dispositionFunction.indexOf("provider_removed")).toBeLessThan(
      dispositionFunction.indexOf(
        'required("GOOGLE_CALENDAR_OAUTH_CLIENT_ID")',
      ),
    );
    const mainFunction = source.slice(
      source.indexOf("async function main()"),
      source.indexOf("if (\n  process.argv[1]"),
    );
    expect(mainFunction).toContain('required("DATABASE_URL_PREVIEW")');
    expect(mainFunction).not.toMatch(
      /required\("(?:GOOGLE_CALENDAR|CALENDAR_CREDENTIAL)/u,
    );
  });

  it("resolves the DB-owned dependency from the repository root and fails safely before secrets", () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: fileURLToPath(new URL("../../..", import.meta.url)),
      env: {
        HOME: process.env.HOME ?? "",
        PATH: process.env.PATH ?? "",
      },
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("DATABASE_URL_PREVIEW_NOT_CONFIGURED\n");
    expect(result.stderr).not.toMatch(/postgres|node_modules|ERR_MODULE/u);
  });
});
