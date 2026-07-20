import postgres from "postgres";

const ownerUrlValue = process.env.DATABASE_URL_PREVIEW?.trim() ?? "";
const productionUrlValue = process.env.DATABASE_URL?.trim() ?? "";
const runtimePassword = process.env.DATABASE_RUNTIME_PASSWORD_PREVIEW ?? "";
const providerSubject = process.env.ZITADEL_PREVIEW_SUBJECT?.trim() ?? "";
const runtimeRole = "werehere_preview_runtime";

function fail(message: string): never {
  throw new Error(message);
}

function databaseUrl(value: string, name: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return fail(`${name} is not a valid URL`);
  }
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !parsed.hostname.endsWith(".neon.tech") || !parsed.pathname ||
    parsed.username === "" || parsed.password === ""
  ) {
    fail(`${name} is not an approved Neon URL`);
  }
  return parsed;
}

if (!ownerUrlValue || !productionUrlValue || !runtimePassword || !providerSubject) {
  fail("Preview auth diagnostic configuration is incomplete");
}
const ownerUrl = databaseUrl(ownerUrlValue, "DATABASE_URL_PREVIEW");
const productionUrl = databaseUrl(productionUrlValue, "DATABASE_URL");
if (ownerUrl.origin === productionUrl.origin && ownerUrl.pathname === productionUrl.pathname) {
  fail("Preview auth diagnostic target aliases Production");
}
const runtimeUrl = new URL(ownerUrl);
runtimeUrl.username = runtimeRole;
runtimeUrl.password = runtimePassword;

const owner = postgres(ownerUrl.toString(), { max: 1, prepare: false });
const runtime = postgres(runtimeUrl.toString(), { max: 1, prepare: false });
const sessionId = crypto.randomUUID();
const tokenHash = crypto.getRandomValues(new Uint8Array(32));
let stage = "RUNTIME_IDENTITY_LOOKUP";
const rollback = new Error("EXPECTED_DIAGNOSTIC_ROLLBACK");

try {
  try {
    await runtime.begin(async (transaction) => {
      const [role] = await transaction<{ current_user: string }[]>`select current_user`;
      if (role?.current_user !== runtimeRole) fail("Preview diagnostic did not use runtime role");
      const identities = await transaction<{
        company_id: string;
        company_status: string;
        display_name: string;
        identity_id: string;
        user_id: string;
        user_status: string;
        user_type: string;
      }[]>`
        select identity.company_id,
               identity.id as identity_id,
               identity.user_id,
               app_user.user_type,
               app_user.display_name,
               app_user.status as user_status,
               company.status as company_status
        from auth_identities identity
        join users app_user
          on app_user.company_id = identity.company_id
         and app_user.id = identity.user_id
        join companies company on company.id = identity.company_id
        where identity.provider = 'ZITADEL'
          and identity.provider_subject = ${providerSubject}
        for share of identity, app_user, company
      `;
      const identity = identities[0];
      if (
        !identity || identity.user_status !== "ACTIVE" ||
        identity.company_status !== "ACTIVE"
      ) {
        fail("Preview diagnostic identity is not an active provisioned principal");
      }

      stage = "RUNTIME_SESSION_INSERT";
      await transaction`
        insert into auth_sessions (
          id, company_id, user_id, identity_id, token_hash,
          idle_expires_at, absolute_expires_at, auth_time, authentication_method
        ) values (
          ${sessionId}, ${identity.company_id}, ${identity.user_id},
          ${identity.identity_id}, ${tokenHash},
          now() + make_interval(secs => 28800),
          now() + make_interval(secs => 86400),
          ${new Date()}, 'OIDC_PKCE'
        )
      `;

      stage = "RUNTIME_AUDIT_INSERT";
      await transaction`
        insert into audit_events (
          id, event_code, actor_user_id, actor_type, session_id,
          company_id, resource_type, resource_id, after_summary,
          result, trace_id
        ) values (
          ${crypto.randomUUID()}, 'AUTH_LOGIN_SUCCEEDED', ${identity.user_id},
          ${identity.user_type}, ${sessionId}, ${identity.company_id},
          'SESSION', ${sessionId}, ${transaction.json({ authenticationMethod: "OIDC_PKCE" })},
          'SUCCEEDED', ${crypto.randomUUID()}
        )
      `;
      stage = "EXPECTED_ROLLBACK";
      throw rollback;
    });
    fail("Preview diagnostic transaction unexpectedly committed");
  } catch (error) {
    if (error !== rollback) {
      const candidate = error as {
        code?: unknown;
        column_name?: unknown;
        constraint_name?: unknown;
        table_name?: unknown;
      };
      console.error("PREVIEW_AUTH_DB_DIAGNOSTIC_FAILED", {
        code: typeof candidate.code === "string" ? candidate.code : "UNKNOWN",
        column: typeof candidate.column_name === "string" ? candidate.column_name : null,
        constraint: typeof candidate.constraint_name === "string" ? candidate.constraint_name : null,
        stage,
        table: typeof candidate.table_name === "string" ? candidate.table_name : null,
      });
      throw new Error("Preview auth callback DB diagnostic failed");
    }
  }

  stage = "ROLLBACK_READ_BACK";
  const [remaining] = await owner<{ audits: number; sessions: number }[]>`
    select
      (select count(*)::int from auth_sessions where id = ${sessionId}) as sessions,
      (select count(*)::int from audit_events where session_id = ${sessionId}) as audits
  `;
  if (!remaining || remaining.sessions !== 0 || remaining.audits !== 0) {
    fail("Preview auth diagnostic rollback read-back failed");
  }
  console.log("PREVIEW_AUTH_DB_SESSION_ROLLBACK_OK");
} finally {
  await Promise.all([
    owner.end({ timeout: 2 }),
    runtime.end({ timeout: 2 }),
  ]);
}
