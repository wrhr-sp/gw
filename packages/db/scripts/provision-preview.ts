import { chmod, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";
import { probeDatabaseReadiness } from "../src/client";

const ownerDatabaseUrl = process.env.DATABASE_URL_PREVIEW?.trim() ?? "";
const productionDatabaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const runtimePassword = process.env.DATABASE_RUNTIME_PASSWORD_PREVIEW ?? "";
const outputFile = process.env.RUNTIME_DATABASE_URL_FILE?.trim() ?? "";
const zitadelSubject = process.env.ZITADEL_PREVIEW_SUBJECT?.trim() ?? "";
const runtimeRole = "werehere_preview_runtime";
const previewCompanyId = "70000000-0000-4000-8000-000000000001";
const previewUserId = "71000000-0000-4000-8000-000000000001";
const previewIdentityId = "72000000-0000-4000-8000-000000000001";
const previewGrantId = "73000000-0000-4000-8000-000000000001";
const localCiTestMode = process.env.PREVIEW_PROVISION_LOCAL_CI_TEST === "1";

function fail(message: string): never {
  throw new Error(message);
}

function parseDatabaseUrl(
  value: string,
  name: string,
  requireNeon: boolean,
): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return fail(`${name} is not a valid URL`);
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    fail(`${name} must use PostgreSQL`);
  }
  const loopback =
    parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  const testDatabase = /_(?:ci|test)$/u.test(parsed.pathname.slice(1));
  if (requireNeon && !parsed.hostname.toLowerCase().endsWith(".neon.tech")) {
    if (
      !localCiTestMode ||
      process.env.CI !== "true" ||
      !loopback ||
      !testDatabase
    ) {
      fail(`${name} is not a Neon target`);
    }
  }
  const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
  if (
    requireNeon &&
    !localCiTestMode &&
    (!sslMode || !["require", "verify-ca", "verify-full"].includes(sslMode))
  ) {
    fail(`${name} must require TLS`);
  }
  return parsed;
}

function targetFingerprint(url: URL): string {
  const port = url.port || "5432";
  const labels = url.hostname.toLowerCase().split(".");
  labels[0] = labels[0]?.replace(/-pooler$/u, "") ?? "";
  return `${labels.join(".")}:${port}${url.pathname}`;
}

async function neonBranchIdentity(sql: postgres.Sql): Promise<{
  branchId: string;
  databaseName: string;
  projectId: string;
}> {
  if (localCiTestMode) {
    const [identity] = await sql<{ database_name: string }[]>`
      select current_database() as database_name
    `;
    if (!identity) fail("Local test database identity is unavailable");
    return {
      branchId: identity.database_name,
      databaseName: identity.database_name,
      projectId: "local-ci-test",
    };
  }
  const [identity] = await sql<
    {
      branch_id: string | null;
      database_name: string;
      project_id: string | null;
    }[]
  >`
    select
      nullif(current_setting('neon.branch_id', true), '') as branch_id,
      current_database() as database_name,
      nullif(current_setting('neon.project_id', true), '') as project_id
  `;
  if (!identity?.branch_id || !identity.project_id) {
    fail("Neon project/branch identity is unavailable");
  }
  return {
    branchId: identity.branch_id,
    databaseName: identity.database_name,
    projectId: identity.project_id,
  };
}

if (!ownerDatabaseUrl) fail("DATABASE_URL_PREVIEW is required");
if (!productionDatabaseUrl)
  fail("DATABASE_URL is required for target separation verification");
if (!runtimePassword) fail("DATABASE_RUNTIME_PASSWORD_PREVIEW is required");
if (!outputFile) fail("RUNTIME_DATABASE_URL_FILE is required");
if (!zitadelSubject) fail("ZITADEL_PREVIEW_SUBJECT is required");

const previewUrl = parseDatabaseUrl(
  ownerDatabaseUrl,
  "DATABASE_URL_PREVIEW",
  true,
);
const productionUrl = parseDatabaseUrl(
  productionDatabaseUrl,
  "DATABASE_URL",
  false,
);
if (localCiTestMode) {
  const productionLoopback =
    productionUrl.hostname === "127.0.0.1" ||
    productionUrl.hostname === "localhost";
  if (
    process.env.CI !== "true" ||
    !productionLoopback ||
    !/_(?:ci|test)$/u.test(productionUrl.pathname.slice(1))
  ) {
    fail(
      "Local provisioning test mode is restricted to loopback CI/test databases",
    );
  }
}
if (targetFingerprint(previewUrl) === targetFingerprint(productionUrl)) {
  fail("Preview and Production database targets must differ");
}

const owner = postgres(ownerDatabaseUrl, { max: 1, prepare: false });
try {
  const previewIdentity = await neonBranchIdentity(owner);
  if (productionUrl.hostname.toLowerCase().endsWith(".neon.tech")) {
    const production = postgres(productionDatabaseUrl, {
      max: 1,
      prepare: false,
    });
    try {
      const productionIdentity = await neonBranchIdentity(production);
      if (
        previewIdentity.projectId === productionIdentity.projectId &&
        previewIdentity.branchId === productionIdentity.branchId &&
        previewIdentity.databaseName === productionIdentity.databaseName
      ) {
        fail("Preview and Production Neon branch targets must differ");
      }
    } finally {
      await production.end({ timeout: 2 });
    }
  }
  await owner`select pg_advisory_lock(hashtextextended('werehere-preview-migration', 0))`;
  const identity = await owner<
    { can_create_role: boolean; current_user: string; database_name: string }[]
  >`
    select
      current_user,
      current_database() as database_name,
      (role_record.rolsuper or role_record.rolcreaterole) as can_create_role
    from pg_roles role_record
    where role_record.rolname = current_user
  `;
  if (!identity[0] || identity[0].current_user === runtimeRole) {
    fail("Preview migration credential must differ from the runtime role");
  }
  if (!identity[0].can_create_role) {
    fail(
      "Preview migration credential must be allowed to create the runtime role",
    );
  }

  const migrationDirectory = resolve(import.meta.dirname, "../migrations");
  const migrations = [
    ["0001_platform_foundation", "0001_platform_foundation.sql"],
    ["0002_auth_session_runtime", "0002_auth_session_runtime.sql"],
    ["0003_hotel_basic_information", "0003_hotel_basic_information.sql"],
  ] as const;

  for (const [version, fileName] of migrations) {
    const markerTable = await owner<{ exists: boolean }[]>`
      select to_regclass('public.schema_migrations') is not null as exists
    `;
    const applied = markerTable[0]?.exists
      ? await owner<{ applied: boolean }[]>`
        select exists(select 1 from public.schema_migrations where version = ${version}) as applied
      `
      : [{ applied: false }];
    if (applied[0]?.applied) continue;
    await owner.unsafe(
      await readFile(resolve(migrationDirectory, fileName), "utf8"),
    );
  }

  await owner.begin(async (sql) => {
    await sql`
      insert into companies (id, legal_name, status)
      values (${previewCompanyId}::uuid, 'Werehere Preview', 'ACTIVE')
      on conflict (id) do nothing
    `;
    const [company] = await sql<{ legal_name: string; status: string }[]>`
      select legal_name, status
      from companies
      where id = ${previewCompanyId}::uuid
    `;
    if (
      company?.legal_name !== "Werehere Preview" ||
      company.status !== "ACTIVE"
    ) {
      fail("Existing Preview company does not match the approved seed");
    }
    await sql`
      insert into users (id, company_id, user_type, display_name, status)
      values (
        ${previewUserId}::uuid,
        ${previewCompanyId}::uuid,
        'INTERNAL_STAFF',
        'Preview 관리자',
        'ACTIVE'
      )
      on conflict (id) do nothing
    `;
    const [user] = await sql<
      {
        company_id: string;
        display_name: string;
        status: string;
        user_type: string;
      }[]
    >`
      select company_id::text, display_name, status, user_type
      from users
      where id = ${previewUserId}::uuid
    `;
    if (
      user?.company_id !== previewCompanyId ||
      user.display_name !== "Preview 관리자" ||
      user.status !== "ACTIVE" ||
      user.user_type !== "INTERNAL_STAFF"
    ) {
      fail("Existing Preview user does not match the approved seed");
    }
    await sql`
      insert into auth_identities (id, company_id, user_id, provider, provider_subject)
      values (
        ${previewIdentityId}::uuid,
        ${previewCompanyId}::uuid,
        ${previewUserId}::uuid,
        'ZITADEL',
        ${zitadelSubject}
      )
      on conflict (provider, provider_subject) do nothing
    `;
    const [identity] = await sql<
      { company_id: string; id: string; user_id: string }[]
    >`
      select company_id::text, id::text, user_id::text
      from auth_identities
      where provider = 'ZITADEL' and provider_subject = ${zitadelSubject}
    `;
    if (
      identity?.company_id !== previewCompanyId ||
      identity.id !== previewIdentityId ||
      identity.user_id !== previewUserId
    ) {
      fail("ZITADEL Preview subject is already mapped to another user");
    }
    await sql`
      insert into permission_grants (
        id,
        company_id,
        branch_id,
        subject_type,
        subject_id,
        permission_code,
        effect,
        valid_from,
        valid_until,
        granted_by,
        reason
      )
      values (
        ${previewGrantId}::uuid,
        ${previewCompanyId}::uuid,
        null,
        'USER',
        ${previewUserId}::uuid,
        'HOTEL_MANAGE',
        'ALLOW',
        '2026-01-01T00:00:00Z'::timestamptz,
        null,
        ${previewUserId}::uuid,
        'Preview 초기 관리자 권한'
      )
      on conflict (id) do nothing
    `;
    const [grant] = await sql<
      {
        branch_id: string | null;
        company_id: string;
        effect: string;
        granted_by: string;
        permission_code: string;
        reason: string;
        subject_id: string;
        subject_type: string;
        valid_from: string;
        valid_until: string | null;
        version: number;
      }[]
    >`
      select
        branch_id::text,
        company_id::text,
        effect,
        granted_by::text,
        permission_code,
        reason,
        subject_id::text,
        subject_type,
        to_char(valid_from at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as valid_from,
        valid_until::text,
        version
      from permission_grants
      where id = ${previewGrantId}::uuid
    `;
    if (
      grant?.branch_id !== null ||
      grant.company_id !== previewCompanyId ||
      grant.effect !== "ALLOW" ||
      grant.granted_by !== previewUserId ||
      grant.permission_code !== "HOTEL_MANAGE" ||
      grant.reason !== "Preview 초기 관리자 권한" ||
      grant.subject_id !== previewUserId ||
      grant.subject_type !== "USER" ||
      grant.valid_from !== "2026-01-01T00:00:00Z" ||
      grant.valid_until !== null ||
      grant.version !== 1
    ) {
      fail(
        "Existing Preview permission grant does not match the approved seed",
      );
    }
  });
  console.log("PREVIEW_PRINCIPAL_SEEDED");

  const [runtimeRoleState] = await owner<{ exists: boolean }[]>`
    select exists(select 1 from pg_roles where rolname = ${runtimeRole}) as exists
  `;
  await owner.unsafe(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = '${runtimeRole}') then
        create role ${runtimeRole} login;
      end if;
    end
    $$
  `);
  if (!runtimeRoleState?.exists) {
    const passwordCommand = await owner<{ command: string }[]>`
      select format(
        'alter role werehere_preview_runtime password %L',
        ${runtimePassword}::text
      ) as command
    `;
    await owner.unsafe(
      passwordCommand[0]?.command ??
        fail("Could not build runtime password command"),
    );
  }
  await owner.unsafe(`
    alter role ${runtimeRole} noinherit;
    revoke all privileges on all tables in schema public from ${runtimeRole};
    revoke create on schema public from ${runtimeRole};
    grant usage on schema public to ${runtimeRole};
    grant select on
      companies, users, auth_identities, auth_sessions,
      auth_login_transactions, schema_migrations, roles, permissions, user_role_memberships,
      user_groups, user_group_memberships, permission_grants,
      branches, hotel_profiles, idempotency_records
    to ${runtimeRole};
    grant insert, update, delete on auth_login_transactions to ${runtimeRole};
    grant insert, update on auth_sessions to ${runtimeRole};
    grant insert on audit_events, branches, hotel_profiles to ${runtimeRole};
    grant insert, update, delete on idempotency_records to ${runtimeRole};
  `);

  const roleSafety = await owner<
    {
      bypass_rls: boolean;
      creates_databases: boolean;
      creates_roles: boolean;
      has_memberships: boolean;
      inherits_roles: boolean;
      owns_public_table: boolean;
      replicates: boolean;
      superuser: boolean;
    }[]
  >`
    select runtime_role.rolsuper as superuser,
           runtime_role.rolbypassrls as bypass_rls,
           runtime_role.rolcreatedb as creates_databases,
           runtime_role.rolcreaterole as creates_roles,
           runtime_role.rolinherit as inherits_roles,
           runtime_role.rolreplication as replicates,
           exists (
             select 1 from pg_auth_members membership
             where membership.member = runtime_role.oid
           ) as has_memberships,
           exists (
             select 1
             from pg_class table_record
             join pg_namespace table_namespace on table_namespace.oid = table_record.relnamespace
             where table_namespace.nspname = 'public'
               and table_record.relkind in ('r', 'p')
               and table_record.relowner = runtime_role.oid
           ) as owns_public_table
    from pg_roles runtime_role
    where runtime_role.rolname = ${runtimeRole}
  `;
  const safety = roleSafety[0];
  if (
    !safety ||
    safety.superuser ||
    safety.bypass_rls ||
    safety.creates_databases ||
    safety.creates_roles ||
    safety.has_memberships ||
    safety.inherits_roles ||
    safety.owns_public_table ||
    safety.replicates
  ) {
    fail("Preview runtime role safety verification failed");
  }

  const runtimeUrl = new URL(previewUrl);
  runtimeUrl.username = runtimeRole;
  runtimeUrl.password = runtimePassword;
  await writeFile(outputFile, runtimeUrl.toString(), { mode: 0o600 });
  await chmod(outputFile, 0o600);

  const readiness = await probeDatabaseReadiness(runtimeUrl.toString());
  if (readiness.status !== "READY") {
    fail(`Preview runtime readiness failed: ${readiness.status}`);
  }

  console.log("PREVIEW_DATABASE_PROVISIONED");
  console.log("PREVIEW_RUNTIME_ROLE_READY");
} finally {
  await owner.end({ timeout: 2 });
}
