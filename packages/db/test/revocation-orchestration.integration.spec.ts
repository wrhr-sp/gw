import { createHash, randomUUID } from "node:crypto";
import type postgres from "postgres";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as script from "../scripts/revoke-preview-bootstrap-sessions";

// Only the PostgreSQL connection transport is redirected. The product's full
// orchestration, validators, identity verifier and revocation provider execute.
const state = vi.hoisted(() => ({
  fault: "",
  deleted: false,
  deletes: 0,
  reads: 0,
  pid: 0,
  transactions: 0,
  injectionCount: 0,
  injectionCommitted: false,
  injectionBlocked: false,
  injectedAcl: "",
  major: 0,
  admin: null as postgres.Sql | null,
}));
const socket = process.env.REVOCATION_TEST_SOCKET;
vi.mock("postgres", async () => {
  const actual = await vi.importActual<{ default: typeof postgres }>(
    "postgres",
  );
  return {
    default: (url: string) => {
      if (
        url !== "postgres://fixture.neon.tech/postgres?sslmode=require" ||
        !process.env.REVOCATION_TEST_SOCKET?.startsWith(
          "/home/wrhrgw/gw/.seal-replay/",
        )
      )
        throw new Error("LOCAL_FIXTURE_REQUIRED");
      const client = actual.default({
        host: process.env.REVOCATION_TEST_SOCKET,
        username: "postgres",
        database: "postgres",
        port: 29462,
        max: 1,
        prepare: false,
        onnotice: () => {},
        connection: {
          application_name: "revocation-local-fixture",
          options:
            "-c neon.branch_id=fixture-branch -c neon.project_id=fixture-project -c lock_timeout=300ms",
        },
      });
      const aclSnapshot = async () =>
        JSON.stringify(
          await state.admin!.unsafe(
            `select c.relacl::text, (select jsonb_agg(a.attacl::text order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns from pg_class c where c.oid='public.preview_bootstrap_session_revocations'::regclass`,
          ),
        );
      const injectDrift = async () => {
        state.injectionCount++;
        const column = state.fault.includes("column");
        try {
          await state.admin!.unsafe(
            column
              ? "grant select(status) on public.preview_bootstrap_session_revocations to postgres with grant option"
              : "revoke select on public.preview_bootstrap_session_revocations from postgres",
          );
          state.injectionCommitted = true;
        } catch (error) {
          if ((error as { code?: string }).code !== "55P03") throw error;
          state.injectionBlocked = true;
        }
        state.injectedAcl = await aclSnapshot();
      };
      return new Proxy(client, {
        apply(target, _this, args) {
          const query = Array.isArray(args[0]) ? args[0].join("?") : "";
          if (
            (state.fault === "marker-failure" ||
              state.fault.endsWith("-marker")) &&
            query.includes("set status = 'INDETERMINATE'")
          )
            return target.unsafe("select 1/0");
          return Reflect.apply(target, target, args);
        },
        get(target, key) {
          if (key !== "begin") return Reflect.get(target, key);
          return async (
            callback: (sql: postgres.TransactionSql) => Promise<unknown>,
          ) => {
            const transactionNumber = state.transactions + 1;
            const value = await target.begin(async (tx) => {
              state.transactions++;
              const pidRows = await tx<
                { pid: number }[]
              >`select pg_backend_pid() as pid`;
              state.pid = pidRows[0]!.pid;
              let columnChecks = 0;
              const wrapped = new Proxy(tx, {
                get(original, property) {
                  if (property !== "unsafe")
                    return Reflect.get(original, property);
                  return async (query: string) => {
                    const gapTransaction = state.fault.startsWith("claim-gap")
                      ? 1
                      : state.fault.startsWith("provider-gap")
                        ? 2
                        : 0;
                    if (
                      gapTransaction === state.transactions &&
                      state.injectionCount === 0 &&
                      query.includes("set (fillfactor=")
                    )
                      await injectDrift();
                    if (
                      (state.fault === "touch" &&
                        query.includes("set (fillfactor=")) ||
                      (state.fault === "touch-middle" &&
                        query.includes('alter column "status" set statistics'))
                    )
                      return original.unsafe("select 1/0");
                    return original.unsafe(query);
                  };
                },
                apply(original, _this, args) {
                  const query = Array.isArray(args[0]) ? args[0].join("?") : "";
                  if (query.includes("from information_schema.columns"))
                    columnChecks++;
                  const validationFault =
                    columnChecks === 2 &&
                    query.includes("from information_schema.columns") &&
                    ((state.fault === "final-validation" &&
                      state.transactions === 1) ||
                      (state.fault === "late-validation" &&
                        state.transactions === 2));
                  if (validationFault) return original.unsafe("select 1/0");
                  const match =
                    (state.fault === "application" &&
                      query.includes("update auth_sessions")) ||
                    (state.fault === "audit" &&
                      query.includes("insert into audit_events")) ||
                    (state.fault === "completion" &&
                      query.includes("set status = 'COMPLETED'"));
                  if (match) return original.unsafe("select 1/0");
                  return Reflect.apply(original, original, args);
                },
              });
              const result = await callback(wrapped);
              if (state.fault === "commit" && state.transactions === 2)
                await tx`select set_config('fixture.fail_commit','on',true)`;
              return result;
            });
            if (
              transactionNumber === 1 &&
              state.fault.startsWith("between-gap") &&
              state.injectionCount === 0
            )
              await injectDrift();
            return value;
          };
        },
      });
    },
  };
});
const company = "70000000-0000-4000-8000-000000000001",
  user = "71000000-0000-4000-8000-000000000001",
  identity = "72000000-0000-4000-8000-000000000001";
const otherUser = "71000000-0000-4000-8000-000000000002",
  otherIdentity = "72000000-0000-4000-8000-000000000002";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
it("exposes the real orchestration as an import-safe execution seam", () =>
  expect(script).toHaveProperty("main", expect.any(Function)));
describe.skipIf(!socket)(
  "actual local revocation orchestration and transport fault injection",
  () => {
    let db: postgres.Sql;
    beforeAll(async () => {
      if (!socket?.startsWith("/home/wrhrgw/gw/.seal-replay/"))
        throw Error("LOCAL_FIXTURE_REQUIRED");
      const actual = await vi.importActual<{ default: typeof postgres }>(
        "postgres",
      );
      db = actual.default({
        host: socket,
        username: "postgres",
        database: "postgres",
        port: 29462,
        max: 1,
        prepare: false,
        onnotice: () => {},
      });
      state.admin = db;
      await db.unsafe("set lock_timeout='300ms'");
      const versionRows = await db<{ major: number }[]>`
        select current_setting('server_version_num')::int / 10000 as major
      `;
      state.major = versionRows[0]!.major;
      await db`insert into companies(id,legal_name) values(${company},'Local test company')`;
      for (const [u, id, subject] of [
        [user, identity, "fixture-subject"],
        [otherUser, otherIdentity, "other-subject"],
      ]) {
        await db`insert into users(id,company_id,user_type,display_name) values(${u!},${company},'INTERNAL_STAFF','Local test user')`;
        await db`insert into auth_identities(id,company_id,user_id,provider,provider_subject) values(${id!},${company},${u!},'ZITADEL',${subject!})`;
      }
      await db.unsafe(
        `create function public.fixture_deferred_failure() returns trigger language plpgsql as $$begin if current_setting('fixture.fail_commit',true)='on' then raise exception 'fixture commit failure'; end if; return new; end$$; create constraint trigger fixture_commit_failure after insert on public.audit_events deferrable initially deferred for each row execute function public.fixture_deferred_failure()`,
      );
    });
    beforeEach(async () => {
      state.fault = "";
      state.deleted = false;
      state.deletes = 0;
      state.reads = 0;
      state.transactions = 0;
      state.injectionCount = 0;
      state.injectionCommitted = false;
      state.injectionBlocked = false;
      state.injectedAcl = "";
      await db.unsafe(
        "truncate preview_bootstrap_session_revocations,preview_bootstrap_operations,auth_sessions,audit_events cascade",
      );
      await db`insert into preview_bootstrap_operations(operation_key,operation_type,subject_fingerprint,request_fingerprint,status) values('fixture-approval','PASSWORD_RESET_EMAIL',${sha("fixture-subject")},${sha("request")},'REQUESTED')`;
      for (const [u, id] of [
        [user, identity],
        [otherUser, otherIdentity],
      ])
        await db`insert into auth_sessions(id,company_id,user_id,identity_id,token_hash,idle_expires_at,absolute_expires_at,auth_time,authentication_method) values(${randomUUID()},${company},${u!},${id!},${Buffer.from(sha(u!), "hex")},now()+interval '1 hour',now()+interval '2 hours',now(),'OIDC')`;
      const env = {
        PREVIEW_BOOTSTRAP_APPROVAL_REF: "fixture-approval",
        DATABASE_URL_PREVIEW:
          "postgres://fixture.neon.tech/postgres?sslmode=require",
        PREVIEW_DATABASE_IDENTITY_SHA256: sha(
          JSON.stringify({
            branchId: "fixture-branch",
            databaseName: "postgres",
            projectId: "fixture-project",
          }),
        ),
        ZITADEL_ISSUER: "https://identity.example.test",
        ZITADEL_ORGANIZATION_ID: "fixture-organization",
        ZITADEL_PREVIEW_SUBJECT: "fixture-subject",
        ZITADEL_PREVIEW_SUBJECT_SHA256: sha("fixture-subject"),
        ZITADEL_PREVIEW_ISSUER_SHA256: sha("https://identity.example.test"),
        ZITADEL_PREVIEW_ORGANIZATION_ID_SHA256: sha("fixture-organization"),
        ZITADEL_USER_PROVISIONER_TOKEN: "fixture-not-a-real-credential",
      };
      for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
      vi.stubGlobal("fetch", async (input: unknown, init?: RequestInit) => {
        const url = String(input),
          method = init?.method;
        const json = (value: unknown) => new Response(JSON.stringify(value));
        if (
          url === "https://identity.example.test/v2/users/fixture-subject" &&
          method === "GET"
        ) {
          state.reads++;
          return json({
            user: {
              userId: "fixture-subject",
              state: "USER_STATE_ACTIVE",
              details: { resourceOwner: "fixture-organization" },
              human: {},
            },
          });
        }
        if (
          url ===
            "https://identity.example.test/management/v1/users/fixture-subject/auth_factors/_search" &&
          method === "POST"
        ) {
          state.reads++;
          return json({
            result: [{ state: "AUTH_FACTOR_STATE_READY", otp: {} }],
          });
        }
        if (
          url === "https://identity.example.test/v2/sessions/search" &&
          method === "POST"
        )
          return json(
            state.deleted
              ? { details: { totalResult: "0" } }
              : {
                  details: { totalResult: "1" },
                  sessions: [
                    {
                      id: "fixture-session",
                      factors: {
                        user: {
                          id: "fixture-subject",
                          organizationId: "fixture-organization",
                        },
                      },
                    },
                  ],
                },
          );
        if (
          url === "https://identity.example.test/v2/sessions/fixture-session" &&
          method === "DELETE"
        ) {
          state.deletes++;
          state.deleted = true;
          if (
            ["inflight-success", "inflight-loss", "marker-failure"].includes(
              state.fault,
            )
          )
            await db`select pg_terminate_backend(${state.pid})`;
          if (state.fault === "inflight-loss")
            throw Error("local response loss");
          return json({ details: {} });
        }
        throw Error("UNEXPECTED_NETWORK_REQUEST");
      });
    });
    afterAll(async () => {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
      await db?.end();
    });
    const run = async () => {
      const main = (script as unknown as { main: () => Promise<void> }).main;
      await main();
    };
    const aclSnapshot = async () =>
      JSON.stringify(
        await db.unsafe(
          `select c.relacl::text, (select jsonb_agg(a.attacl::text order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns from pg_class c where c.oid='public.preview_bootstrap_session_revocations'::regclass`,
        ),
      );
    const restoreInjectedAcl = async (kind: "table" | "column") => {
      await db.unsafe(
        kind === "table"
          ? "grant select on public.preview_bootstrap_session_revocations to postgres"
          : "revoke all privileges(status) on public.preview_bootstrap_session_revocations from postgres cascade",
      );
    };
    const counts = async () => ({
      ledger:
        await db`select status,provider_revoked_count,application_revoked_count from preview_bootstrap_session_revocations`,
      target:
        await db`select count(*)::int as n from auth_sessions where user_id=${user} and revoked_at is not null`,
      other:
        await db`select count(*)::int as n from auth_sessions where user_id=${otherUser} and revoked_at is not null`,
      audit:
        await db`select count(*)::int as n from audit_events where event_code='ACCOUNT_SESSION_REVOKED'`,
    });
    it("commits exact target revocation and audit once; completed replay does not DELETE again", async () => {
      await run();
      const first = await counts();
      expect(first.ledger[0]).toMatchObject({
        status: "COMPLETED",
        provider_revoked_count: 1,
        application_revoked_count: 1,
      });
      expect(first.target[0]?.n).toBe(1);
      expect(first.other[0]?.n).toBe(0);
      expect(first.audit[0]?.n).toBe(1);
      expect(state.deletes).toBe(1);
      await run();
      expect(await counts()).toEqual(first);
      expect(state.deletes).toBe(1);
      expect(state.reads).toBe(4);
    });
    for (const privilege of ["select", "update(status)"]) {
      it(`rejects committed ${privilege} drift without repairing it or entering revocation`, async () => {
        await db.unsafe(
          `grant ${privilege} on public.preview_bootstrap_session_revocations to public`,
        );
        const snapshot = async () =>
          JSON.stringify(
            await db`select c.relacl::text, (select jsonb_agg(a.attacl::text order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns from pg_class c where c.oid='public.preview_bootstrap_session_revocations'::regclass`,
          );
        const before = await snapshot();
        try {
          await expect(run()).rejects.toThrow(
            "Preview bootstrap session revocation failed",
          );
          expect(await snapshot()).toBe(before);
          expect(state.deletes).toBe(0);
          expect((await counts()).ledger).toHaveLength(0);
        } finally {
          await db.unsafe(
            `revoke ${privilege} on public.preview_bootstrap_session_revocations from public`,
          );
        }
      });
      it(`rejects contender-first ${privilege} without entering revocation`, async () => {
        await expect(
          db.begin(async (tx) => {
            await tx.unsafe(
              `grant ${privilege} on public.preview_bootstrap_session_revocations to public`,
            );
            await expect(run()).rejects.toThrow(
              "Preview bootstrap session revocation failed",
            );
            expect(state.deletes).toBe(0);
            throw new Error("ROLLBACK_LOCAL_CONTENDER");
          }),
        ).rejects.toThrow("ROLLBACK_LOCAL_CONTENDER");
        expect((await counts()).ledger).toHaveLength(0);
      });
    }
    for (const phase of ["claim", "provider", "between"] as const)
      for (const kind of ["table", "column"] as const)
        it(`preserves committed ${kind} ACL drift at the ${phase} boundary and never enters DELETE`, async () => {
          const baseline = await aclSnapshot();
          state.fault = `${phase}-gap-${kind}`;
          const mustCommit = state.major === 16 || phase === "between";
          if (mustCommit)
            await expect(run()).rejects.toThrow(
              "Preview bootstrap session revocation failed",
            );
          else await run();
          const result = await counts();
          expect(state.injectionCount).toBe(1);
          expect(state.injectionCommitted).toBe(mustCommit);
          expect(state.injectionBlocked).toBe(!mustCommit);
          expect(await aclSnapshot()).toBe(state.injectedAcl);
          expect(state.deletes).toBe(mustCommit ? 0 : 1);
          if (!mustCommit) {
            expect(result.ledger[0]?.status).toBe("COMPLETED");
            expect(await aclSnapshot()).toBe(baseline);
            return;
          }
          expect(result.ledger[0]?.status ?? null).toBe(
            phase === "claim" ? null : "INDETERMINATE",
          );
          state.fault = "";
          if (phase !== "claim") {
            await expect(run()).rejects.toThrow(
              "Preview bootstrap session revocation failed",
            );
            expect(state.deletes).toBe(0);
            expect(await counts()).toEqual(result);
          }
          await restoreInjectedAcl(kind);
          expect(await aclSnapshot()).toBe(baseline);
        });

    for (const phase of ["provider", "between"] as const)
      for (const kind of ["table", "column"] as const)
        it(`retains REQUESTING when ${phase} ${kind} drift is committed and the failure marker also fails`, async () => {
          const baseline = await aclSnapshot();
          state.fault = `${phase}-gap-${kind}-marker`;
          const mustCommit = state.major === 16 || phase === "between";
          if (mustCommit)
            await expect(run()).rejects.toThrow(
              "Preview bootstrap session revocation failed",
            );
          else await run();
          const result = await counts();
          expect(state.injectionCount).toBe(1);
          expect(await aclSnapshot()).toBe(state.injectedAcl);
          expect(state.deletes).toBe(mustCommit ? 0 : 1);
          if (!mustCommit) {
            expect(result.ledger[0]?.status).toBe("COMPLETED");
            expect(await aclSnapshot()).toBe(baseline);
            return;
          }
          expect(result.ledger[0]?.status).toBe("REQUESTING");
          state.fault = "";
          await expect(run()).rejects.toThrow(
            "Preview bootstrap session revocation failed",
          );
          expect(state.deletes).toBe(0);
          expect(await counts()).toEqual(result);
          await restoreInjectedAcl(kind);
          expect(await aclSnapshot()).toBe(baseline);
        });

    for (const fault of [
      "touch",
      "touch-middle",
      "final-validation",
      "late-validation",
      "inflight-success",
      "inflight-loss",
      "application",
      "audit",
      "completion",
      "commit",
      "marker-failure",
    ])
      it(`fails safely at ${fault} and blocks duplicate revocation`, async () => {
        state.fault = fault;
        await expect(run()).rejects.toThrow(
          "Preview bootstrap session revocation failed",
        );
        const result = await counts();
        expect(result.target[0]?.n).toBe(0);
        expect(result.other[0]?.n).toBe(0);
        expect(result.audit[0]?.n).toBe(0);
        const aclRows =
          await db`select attacl from pg_attribute where attrelid='public.preview_bootstrap_session_revocations'::regclass and attnum>0 and not attisdropped and coalesce(cardinality(attacl),0)>0`;
        expect(aclRows).toHaveLength(0);
        if (["touch", "touch-middle", "final-validation"].includes(fault)) {
          expect(result.ledger).toHaveLength(0);
          expect(state.deletes).toBe(0);
          return;
        }
        expect(result.ledger[0]?.status).toBe(
          fault === "marker-failure" ? "REQUESTING" : "INDETERMINATE",
        );
        expect(state.deletes).toBe(fault === "late-validation" ? 0 : 1);
        state.fault = "";
        await expect(run()).rejects.toThrow(
          "Preview bootstrap session revocation failed",
        );
        expect(state.deletes).toBe(fault === "late-validation" ? 0 : 1);
        expect(await counts()).toEqual(result);
      });
  },
);
