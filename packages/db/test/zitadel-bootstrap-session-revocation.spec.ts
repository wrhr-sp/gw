import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { revokeZitadelBootstrapSessions } from "../src/zitadel-bootstrap-session-revocation";

const issuer = "https://identity.example.test";
const organizationId = "preview-organization";
const subject = "preview-subject";
const token = "secret-provider-token-value";
const revocationScript = readFileSync(
  new URL("../scripts/revoke-preview-bootstrap-sessions.ts", import.meta.url),
  "utf8",
);
const provisioningScript = readFileSync(
  new URL("../scripts/provision-preview.ts", import.meta.url),
  "utf8",
);
const captureWorkflow = readFileSync(
  new URL(
    "../../../.github/workflows/preview-capture-database-identity.yml",
    import.meta.url,
  ),
  "utf8",
);
const revocationWorkflow = readFileSync(
  new URL(
    "../../../.github/workflows/preview-revoke-bootstrap-sessions.yml",
    import.meta.url,
  ),
  "utf8",
);

function session(id: string, userId = subject, owner = organizationId) {
  return {
    id,
    factors: { user: { id: userId, organizationId: owner } },
  };
}

function listResponse(sessions: ReturnType<typeof session>[] = []) {
  return new Response(
    JSON.stringify({
      details: { totalResult: String(sessions.length) },
      ...(sessions.length > 0 ? { sessions } : {}),
    }),
  );
}

describe("ZITADEL bootstrap session revocation", () => {
  it("captures only an encrypted approved Preview database identity", () => {
    for (const contract of [
      "permissions:",
      "contents: read",
      "PREVIEW_DATABASE_IDENTITY_CAPTURE_PUBLIC_KEY_SHA256",
      "RSA_PKCS1_OAEP_PADDING",
      'oaepHash: "sha256"',
      "preview-database-identity.enc",
      "retention-days: 1",
      "DATABASE_URL_PREVIEW",
      "working-directory: packages/db",
    ]) {
      expect(captureWorkflow).toContain(contract);
    }
    expect(captureWorkflow).not.toContain("secrets.DATABASE_URL }}");
    expect(captureWorkflow).not.toContain(
      "process.stdout.write(identityFingerprint)",
    );
    for (const stage of [
      "START",
      "INPUTS",
      "SUBJECT_FINGERPRINT",
      "DATABASE_URL",
      "PUBLIC_KEY_FORMAT",
      "PUBLIC_KEY_FINGERPRINT",
      "PUBLIC_KEY_CONTRACT",
      "POSTGRES_IMPORT",
      "DATABASE_CONNECT",
      "DATABASE_QUERY",
      "DATABASE_QUERY_PERMISSION",
      "DATABASE_QUERY_RELATION",
      "DATABASE_QUERY_COLUMN",
      "DATABASE_QUERY_OTHER",
      "DATABASE_METADATA",
      "DATABASE_OWNER",
      "DATABASE_TUPLE",
      "RESET_LEDGER",
      "ENCRYPT",
      "ARTIFACT_READY",
    ]) {
      expect(captureWorkflow).toContain(`"${stage}"`);
    }
    expect(captureWorkflow).toContain(
      "Preview database identity capture failed at ${stage}",
    );
    expect(captureWorkflow).not.toContain("catch((error)");
    expect(captureWorkflow).not.toContain("error.message");
    expect(captureWorkflow).not.toContain("response.body");
    expect(captureWorkflow).toContain('code === "42501"');
    expect(captureWorkflow).toContain('code === "42P01"');
    expect(captureWorkflow).toContain('code === "42703"');
    expect(revocationWorkflow).toContain(
      "PREVIEW_DATABASE_IDENTITY_SHA256: ${{ secrets.PREVIEW_DATABASE_IDENTITY_SHA256 }}",
    );
    expect(revocationWorkflow).not.toContain("secrets.DATABASE_URL }}");
  });

  it("registers migration 0024 in the Preview contract dispatcher", () => {
    expect(
      provisioningScript.match(/0024_preview_bootstrap_session_revocations/gu),
    ).toHaveLength(3);
    expect(provisioningScript).toContain(
      '"0024_preview_bootstrap_session_revocations.sql"',
    );
  });

  it("claims a fixed Preview tuple after target separation and before provider mutation", () => {
    for (const value of [
      "70000000-0000-4000-8000-000000000001",
      "71000000-0000-4000-8000-000000000001",
      "72000000-0000-4000-8000-000000000001",
      '"PREVIEW_DATABASE_IDENTITY_SHA256"',
      "databaseIdentityFingerprint",
      "assertPreviewBootstrapSessionRevocationLedgerReady(transaction)",
      "preview_bootstrap_session_revocations",
      "status = 'INDETERMINATE'",
      "status = 'COMPLETED'",
    ]) {
      expect(revocationScript).toContain(value);
    }
    const claim = revocationScript.indexOf(
      "insert into preview_bootstrap_session_revocations",
    );
    const providerMutation = revocationScript.indexOf(
      "const provider = await revokeZitadelBootstrapSessions",
    );
    expect(claim).toBeGreaterThan(0);
    expect(providerMutation).toBeGreaterThan(claim);
    expect(
      revocationScript.match(
        /lockPreviewBootstrapTuple\(transaction, subject\)/gu,
      ),
    ).toHaveLength(2);
    expect(revocationScript).toContain("'ACCOUNT_SESSION_REVOKED'");
    expect(revocationScript).toMatch(
      /previous\?\.status === "COMPLETED"[\s\S]+return "COMPLETED" as const[\s\S]+if \(claim === "COMPLETED"\)[\s\S]+return;/u,
    );
  });

  it("serializes readiness, provider revocation, application revocation, audit, and completion", () => {
    const claimed = revocationScript.indexOf("claimed = true;");
    const finalTransaction = revocationScript.indexOf(
      "await preview.begin(async (transaction)",
      claimed,
    );
    const readiness = revocationScript.indexOf(
      "assertPreviewBootstrapSessionRevocationLedgerReady(transaction)",
      finalTransaction,
    );
    const operationLock = revocationScript.indexOf("for update", readiness);
    const providerMutation = revocationScript.indexOf(
      "const provider = await revokeZitadelBootstrapSessions",
      operationLock,
    );
    const providerReadback = revocationScript.indexOf(
      "const providerReadback = await revokeZitadelBootstrapSessions",
      providerMutation,
    );
    const applicationRevoke = revocationScript.indexOf(
      "update auth_sessions",
      providerReadback,
    );
    const audit = revocationScript.indexOf(
      "insert into audit_events",
      applicationRevoke,
    );
    const completion = revocationScript.indexOf(
      "update preview_bootstrap_session_revocations",
      audit,
    );
    const transactionEnd = revocationScript.indexOf(
      "    });\n    claimed = false;",
      completion,
    );
    expect(finalTransaction).toBeGreaterThan(claimed);
    expect(readiness).toBeGreaterThan(finalTransaction);
    expect(operationLock).toBeGreaterThan(readiness);
    expect(providerMutation).toBeGreaterThan(operationLock);
    expect(providerReadback).toBeGreaterThan(providerMutation);
    expect(applicationRevoke).toBeGreaterThan(providerReadback);
    expect(audit).toBeGreaterThan(applicationRevoke);
    expect(completion).toBeGreaterThan(audit);
    expect(transactionEnd).toBeGreaterThan(completion);
    expect(revocationScript).toContain(
      "lock table public.preview_bootstrap_session_revocations in access exclusive mode",
    );
    expect(
      revocationScript.match(/await preview\.begin\(async \(transaction\)/gu),
    ).toHaveLength(2);
    expect(
      revocationScript.match(
        /assertPreviewBootstrapSessionRevocationLedgerReady\(transaction\)/gu,
      ),
    ).toHaveLength(2);
  });

  it("lists the exact approved user, deletes every returned session, and reads back zero", async () => {
    const responses = [
      listResponse([session("session-1"), session("session-2")]),
      new Response(JSON.stringify({ details: {} })),
      new Response(JSON.stringify({ details: {} })),
      listResponse(),
    ];
    const fetcher = vi.fn(async () => responses.shift()!);

    await expect(
      revokeZitadelBootstrapSessions({
        fetcher: fetcher as typeof fetch,
        issuer,
        organizationId,
        subject,
        token,
      }),
    ).resolves.toEqual({
      remainingCount: 0,
      revokedCount: 2,
      status: "REVOKED",
    });

    expect(fetcher).toHaveBeenCalledTimes(4);
    const calls = fetcher.mock.calls as unknown as [string, RequestInit?][];
    const [listUrl, listInit] = calls[0]!;
    expect(listUrl).toBe(`${issuer}/v2/sessions/search`);
    expect(listInit).toMatchObject({ method: "POST", redirect: "manual" });
    expect(JSON.parse(String(listInit?.body))).toEqual({
      query: { asc: true, limit: 100 },
      queries: [{ userIdQuery: { id: subject } }],
    });
    expect(listInit?.headers).toMatchObject({
      authorization: `Bearer ${token}`,
      "x-zitadel-orgid": organizationId,
    });
    expect(calls[1]?.[0]).toBe(`${issuer}/v2/sessions/session-1`);
    expect(calls[1]?.[1]).toMatchObject({ method: "DELETE", body: "{}" });
    expect(calls[2]?.[0]).toBe(`${issuer}/v2/sessions/session-2`);
    expect(calls[2]?.[1]).toMatchObject({ method: "DELETE", body: "{}" });
  });

  it("fails before deletion when a returned session is not bound to the approved identity", async () => {
    const fetcher = vi.fn(async () =>
      listResponse([session("session-1", "other-user")]),
    );
    await expect(
      revokeZitadelBootstrapSessions({
        fetcher: fetcher as typeof fetch,
        issuer,
        organizationId,
        subject,
        token,
      }),
    ).rejects.toThrow("ZITADEL bootstrap session revocation failed");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fails closed when session.delete permission is unavailable", async () => {
    const responses = [
      listResponse([session("session-1")]),
      new Response("forbidden", { status: 403 }),
      listResponse([session("session-1")]),
    ];
    const fetcher = vi.fn(async () => responses.shift()!);
    await expect(
      revokeZitadelBootstrapSessions({
        fetcher: fetcher as typeof fetch,
        issuer,
        organizationId,
        subject,
        token,
      }),
    ).rejects.toThrow("ZITADEL bootstrap session revocation failed");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("accepts an ambiguous delete only after authoritative absence", async () => {
    const responses = [
      listResponse([session("session-1")]),
      new Response("not found", { status: 404 }),
      listResponse(),
      listResponse(),
    ];
    const fetcher = vi.fn(async () => responses.shift()!);
    await expect(
      revokeZitadelBootstrapSessions({
        fetcher: fetcher as typeof fetch,
        issuer,
        organizationId,
        subject,
        token,
      }),
    ).resolves.toEqual({
      remainingCount: 0,
      revokedCount: 0,
      status: "REVOKED",
    });
    const calls = fetcher.mock.calls as unknown as [string, RequestInit?][];
    expect(JSON.parse(String(calls[2]?.[1]?.body))).toEqual({
      query: { asc: true, limit: 100 },
      queries: [{ idsQuery: { ids: ["session-1"] } }],
    });
  });

  it("reads session presence without mutation in READ_ONLY mode", async () => {
    const fetcher = vi.fn(async () => listResponse([session("session-1")]));
    await expect(
      revokeZitadelBootstrapSessions({
        fetcher: fetcher as typeof fetch,
        issuer,
        mode: "READ_ONLY",
        organizationId,
        subject,
        token,
      }),
    ).resolves.toEqual({
      remainingCount: 1,
      revokedCount: 0,
      status: "REVOKED",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const calls = fetcher.mock.calls as unknown as [string, RequestInit?][];
    expect(calls[0]?.[1]).toMatchObject({ method: "POST" });
  });

  it("performs a final zero read-back after deleting exactly 2000 sessions", async () => {
    let listCount = 0;
    const fetcher = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        if (init?.method === "DELETE") {
          return new Response(JSON.stringify({ details: {} }));
        }
        listCount += 1;
        if (listCount > 20) return listResponse();
        return listResponse(
          Array.from({ length: 100 }, (_, index) =>
            session(`session-${listCount}-${index}`),
          ),
        );
      },
    );
    await expect(
      revokeZitadelBootstrapSessions({
        fetcher: fetcher as typeof fetch,
        issuer,
        organizationId,
        subject,
        token,
      }),
    ).resolves.toEqual({
      remainingCount: 0,
      revokedCount: 2000,
      status: "REVOKED",
    });
    expect(listCount).toBe(21);
  });

  it("rejects omitted sessions when authoritative totalResult is nonzero", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ details: { totalResult: "1" } })),
    );
    await expect(
      revokeZitadelBootstrapSessions({
        fetcher: fetcher as typeof fetch,
        issuer,
        mode: "READ_ONLY",
        organizationId,
        subject,
        token,
      }),
    ).rejects.toThrow("ZITADEL bootstrap session revocation failed");
  });

  it.each([
    { issuer: ` ${issuer}`, organizationId, subject, token },
    { issuer, organizationId: ` ${organizationId}`, subject, token },
    { issuer, organizationId, subject: "../subject", token },
    { issuer, organizationId, subject, token: "short" },
  ])("rejects malformed input before network", async (input) => {
    const fetcher = vi.fn();
    await expect(
      revokeZitadelBootstrapSessions({
        ...input,
        fetcher: fetcher as typeof fetch,
      }),
    ).rejects.toThrow("ZITADEL bootstrap session revocation failed");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not include identity or token values in failures", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error(`${subject}:${token}`);
    });
    let message = "";
    try {
      await revokeZitadelBootstrapSessions({
        fetcher: fetcher as typeof fetch,
        issuer,
        organizationId,
        subject,
        token,
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toBe("ZITADEL bootstrap session revocation failed");
    expect(message).not.toContain(subject);
    expect(message).not.toContain(token);
  });
});
