import { chmod, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import postgres from "postgres";
import { probeDatabaseReadiness } from "../src/client";

const ownerDatabaseUrl = process.env.DATABASE_URL_PREVIEW?.trim() ?? "";
const productionDatabaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const apiRuntimePassword =
  process.env.DATABASE_API_RUNTIME_PASSWORD_PREVIEW ?? "";
const reconcilerPassword =
  process.env.DATABASE_RECONCILER_PASSWORD_PREVIEW ?? "";
const apiOutputFile = process.env.API_RUNTIME_DATABASE_URL_FILE?.trim() ?? "";
const reconcilerOutputFile =
  process.env.RECONCILER_DATABASE_URL_FILE?.trim() ?? "";
const zitadelSubject = process.env.ZITADEL_PREVIEW_SUBJECT?.trim() ?? "";
const approvedSubjectFingerprint =
  process.env.ZITADEL_PREVIEW_SUBJECT_SHA256?.trim().toLowerCase() ?? "";
const zitadelOrganizationId =
  process.env.ZITADEL_PREVIEW_ORGANIZATION_ID?.trim() ?? "";
const bootstrapApprovalReference =
  process.env.PREVIEW_BOOTSTRAP_APPROVAL_REF?.trim() ?? "";
const localCiAdminDatabaseUrl =
  process.env.PREVIEW_PROVISION_ADMIN_DATABASE_URL?.trim() ?? "";
const apiRuntimeRole = "werehere_preview_api_runtime";
const reconcilerRole = "werehere_preview_reconciler";
const previewCompanyId = "70000000-0000-4000-8000-000000000001";
const previewUserId = "71000000-0000-4000-8000-000000000001";
const previewIdentityId = "72000000-0000-4000-8000-000000000001";
const previewGrantId = "73000000-0000-4000-8000-000000000001";
const previewUserReadGrantId = "73000000-0000-4000-8000-000000000002";
const previewUserCreateGrantId = "73000000-0000-4000-8000-000000000003";
const previewUserSuspendGrantId = "73000000-0000-4000-8000-000000000004";
const previewBootstrapAuditId = "74000000-0000-4000-8000-000000000001";
const localCiTestMode = process.env.PREVIEW_PROVISION_LOCAL_CI_TEST === "1";
const provisionPhase =
  process.env.PREVIEW_PROVISION_PHASE?.trim().toUpperCase() || "CONTRACT";

function fail(message: string): never {
  throw new Error(message);
}

if (provisionPhase !== "EXPAND" && provisionPhase !== "CONTRACT") {
  fail("PREVIEW_PROVISION_PHASE must be EXPAND or CONTRACT");
}
const contractPhase = provisionPhase === "CONTRACT";

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
if (!apiRuntimePassword)
  fail("DATABASE_API_RUNTIME_PASSWORD_PREVIEW is required");
if (!reconcilerPassword)
  fail("DATABASE_RECONCILER_PASSWORD_PREVIEW is required");
if (apiRuntimePassword === reconcilerPassword)
  fail("Preview runtime passwords must differ");
if (!apiOutputFile) fail("API_RUNTIME_DATABASE_URL_FILE is required");
if (!reconcilerOutputFile) fail("RECONCILER_DATABASE_URL_FILE is required");
if (!zitadelSubject) fail("ZITADEL_PREVIEW_SUBJECT is required");
if (!/^[0-9a-f]{64}$/u.test(approvedSubjectFingerprint))
  fail("ZITADEL_PREVIEW_SUBJECT_SHA256 is required");
const actualSubjectFingerprint = createHash("sha256")
  .update(zitadelSubject, "utf8")
  .digest("hex");
if (actualSubjectFingerprint !== approvedSubjectFingerprint)
  fail("ZITADEL Preview subject fingerprint mismatch");
if (!zitadelOrganizationId) fail("ZITADEL_PREVIEW_ORGANIZATION_ID is required");
if (!bootstrapApprovalReference)
  fail("PREVIEW_BOOTSTRAP_APPROVAL_REF is required");

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
  if (localCiAdminDatabaseUrl) {
    const localAdminUrl = parseDatabaseUrl(
      localCiAdminDatabaseUrl,
      "PREVIEW_PROVISION_ADMIN_DATABASE_URL",
      false,
    );
    const adminLoopback =
      localAdminUrl.hostname === "127.0.0.1" ||
      localAdminUrl.hostname === "localhost";
    if (
      !adminLoopback ||
      targetFingerprint(localAdminUrl) !== targetFingerprint(previewUrl)
    ) {
      fail(
        "Local provisioning admin target must be the same loopback Preview test database",
      );
    }
  }
} else if (localCiAdminDatabaseUrl) {
  fail(
    "PREVIEW_PROVISION_ADMIN_DATABASE_URL is restricted to local CI test mode",
  );
}
if (targetFingerprint(previewUrl) === targetFingerprint(productionUrl)) {
  fail("Preview and Production database targets must differ");
}

const owner = postgres(ownerDatabaseUrl, { max: 1, prepare: false });
let migrationOwnerRoleForCleanup: string | null = null;
let localCiMembershipCleanupRequired = false;

async function updateLocalCiDefinerMembership(
  migrationOwnerRole: string,
  action: "GRANT" | "REVOKE",
): Promise<void> {
  if (!localCiAdminDatabaseUrl) return;
  const localAdmin = postgres(localCiAdminDatabaseUrl, {
    max: 1,
    prepare: false,
  });
  try {
    const commands =
      action === "GRANT"
        ? await localAdmin<{ command: string }[]>`
          select format(
            'grant %I to %I with admin true, inherit false, set false',
            definer_role.rolname,
            ${migrationOwnerRole}::text
          ) as command
          from pg_roles definer_role
          where definer_role.rolname in (
            'werehere_auth_session_definer',
            'werehere_tenant_authority_definer'
          )
        `
        : await localAdmin<{ command: string }[]>`
          select format(
            'revoke %I from %I granted by %I',
            definer_role.rolname,
            ${migrationOwnerRole}::text,
            current_user
          ) as command
          from pg_roles definer_role
          where definer_role.rolname in (
            'werehere_auth_session_definer',
            'werehere_tenant_authority_definer'
          )
        `;
    for (const command of commands) {
      await localAdmin.unsafe(command.command);
    }
  } finally {
    await localAdmin.end({ timeout: 2 });
  }
}

try {
  const [migrationOwnerIdentity] = await owner<
    { role_identifier: string; role_name: string }[]
  >`
    select current_user as role_name,
           format('%I', current_user) as role_identifier
  `;
  if (!migrationOwnerIdentity)
    fail("Preview migration owner identity is unavailable");
  migrationOwnerRoleForCleanup = migrationOwnerIdentity.role_name;
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
  if (
    !identity[0] ||
    [apiRuntimeRole, reconcilerRole].includes(identity[0].current_user)
  ) {
    fail("Preview migration credential must differ from both runtime roles");
  }
  if (!identity[0].can_create_role) {
    fail(
      "Preview migration credential must be allowed to create the runtime role",
    );
  }

  const [existingMigrationMarker] = await owner<{ exists: boolean }[]>`
    select to_regclass('public.schema_migrations') is not null as exists
  `;
  if (existingMigrationMarker?.exists) {
    const [ownershipPreflight] = await owner<
      { marker_owner_safe: boolean; unexpected_sequence_owners: number }[]
    >`
      select migration_table.relowner = current_user::regrole::oid as marker_owner_safe,
             (
               select count(*)::integer
               from pg_class sequence_record
               join pg_namespace sequence_namespace
                 on sequence_namespace.oid = sequence_record.relnamespace
               where sequence_namespace.nspname = 'public'
                 and sequence_record.relkind = 'S'
                 and sequence_record.relowner <> current_user::regrole::oid
             ) as unexpected_sequence_owners
      from pg_class migration_table
      join pg_namespace migration_namespace
        on migration_namespace.oid = migration_table.relnamespace
      where migration_namespace.nspname = 'public'
        and migration_table.relname = 'schema_migrations'
        and migration_table.relkind in ('r', 'p')
    `;
    if (
      !ownershipPreflight?.marker_owner_safe ||
      ownershipPreflight.unexpected_sequence_owners !== 0
    ) {
      fail("Preview ownership preflight failed before database mutation");
    }
  }

  await updateLocalCiDefinerMembership(
    migrationOwnerIdentity.role_name,
    "GRANT",
  );
  localCiMembershipCleanupRequired = Boolean(localCiAdminDatabaseUrl);

  const migrationDirectory = resolve(import.meta.dirname, "../migrations");
  const allMigrations = [
    ["0001_platform_foundation", "0001_platform_foundation.sql"],
    ["0002_auth_session_runtime", "0002_auth_session_runtime.sql"],
    ["0003_hotel_basic_information", "0003_hotel_basic_information.sql"],
    ["0004_custom_login_security", "0004_custom_login_security.sql"],
    ["0005_auth_session_definer", "0005_auth_session_definer.sql"],
    ["0006_account_administration", "0006_account_administration.sql"],
    [
      "0007_api_tenant_authority_expand",
      "0007_api_tenant_authority_expand.sql",
    ],
    ["0009_global_login_id_expand", "0009_global_login_id_expand.sql"],
    [
      "0011_account_provider_exact_dispatch",
      "0011_account_provider_exact_dispatch.sql",
    ],
    [
      "0008_remove_legacy_company_id_fallback",
      "0008_remove_legacy_company_id_fallback.sql",
    ],
    [
      "0012_account_provider_exact_dispatch_contract",
      "0012_account_provider_exact_dispatch_contract.sql",
    ],
    ["0010_global_login_id_contract", "0010_global_login_id_contract.sql"],
  ] as const;
  const contractOnlyMigrations = new Set([
    "0008_remove_legacy_company_id_fallback",
    "0010_global_login_id_contract",
    "0012_account_provider_exact_dispatch_contract",
  ]);
  const migrations = contractPhase
    ? allMigrations.filter(([version]) => version !== "0010_global_login_id_contract")
    : allMigrations.filter(([version]) => !contractOnlyMigrations.has(version));

  const bootstrapSchema = await owner<{ exists: boolean }[]>`
    select to_regclass('public.users') is not null
       and to_regclass('public.auth_identities') is not null
       and to_regclass('public.login_id_registry') is not null as exists
  `;
  if (contractPhase && bootstrapSchema[0]?.exists) {
    await owner.begin(async (sql) => {
      const rows = await sql<
        {
          company_id: string;
          login_name: string | null;
          provider_subject: string | null;
          status: string;
        }[]
      >`
        select app_user.company_id::text,
               app_user.login_name,
               app_user.status,
               identity.provider_subject
        from public.users app_user
        left join public.auth_identities identity
          on identity.company_id = app_user.company_id
         and identity.user_id = app_user.id
         and identity.provider = 'ZITADEL'
        where app_user.id = ${previewUserId}::uuid
      `;
      if (rows.length > 0) {
        if (
          rows.length !== 1 ||
          rows[0]?.company_id !== previewCompanyId ||
          rows[0].provider_subject !== zitadelSubject ||
          rows[0].status !== "ACTIVE" ||
          !["preview-admin", "previewadmin"].includes(rows[0].login_name ?? "")
        ) {
          fail("Existing Preview bootstrap identity cannot be aligned safely");
        }
        if (rows[0].login_name === "preview-admin") {
          const collision = await sql<{ exists: boolean }[]>`
            select exists (
              select 1 from public.users
              where lower(btrim(login_name)) = 'previewadmin'
                and id <> ${previewUserId}::uuid
            ) as exists
          `;
          if (collision[0]?.exists) {
            fail("Preview bootstrap canonical login ID is unavailable");
          }
          await sql`
            insert into public.login_id_registry (login_id, company_id, target_user_id)
            values ('previewadmin', ${previewCompanyId}::uuid, ${previewUserId}::uuid)
            on conflict (login_id) do nothing
          `;
          const [registryClaim] = await sql<{ company_id: string; target_user_id: string }[]>`
            select company_id::text, target_user_id::text
            from public.login_id_registry
            where login_id = 'previewadmin'
          `;
          if (
            registryClaim?.company_id !== previewCompanyId ||
            registryClaim.target_user_id !== previewUserId
          ) {
            fail("Preview bootstrap canonical login ID registry claim is unavailable");
          }
          await sql`
            update public.users
            set login_name = 'previewadmin',
                version = version + 1,
                updated_at = pg_catalog.statement_timestamp()
            where id = ${previewUserId}::uuid
              and company_id = ${previewCompanyId}::uuid
              and login_name = 'preview-admin'
          `;
          await sql`
            update public.auth_sessions
            set revoked_at = pg_catalog.statement_timestamp(),
                revoke_reason = 'PREVIEW_BOOTSTRAP_LOGIN_ID_ALIGNED',
                session_version = session_version + 1
            where company_id = ${previewCompanyId}::uuid
              and user_id = ${previewUserId}::uuid
              and revoked_at is null
          `;
          await sql`
            insert into public.audit_events (
              id, event_code, actor_user_id, actor_type, session_id, company_id,
              resource_type, resource_id, before_summary, after_summary, reason,
              result, trace_id
            ) values (
              pg_catalog.gen_random_uuid(), 'PREVIEW_BOOTSTRAP_LOGIN_ID_ALIGNED',
              ${previewUserId}::uuid, 'SYSTEM', null, ${previewCompanyId}::uuid,
              'USER', ${previewUserId}::uuid,
              pg_catalog.jsonb_build_object('state', 'LEGACY_NON_CANONICAL'),
              pg_catalog.jsonb_build_object('state', 'MVP_CANONICAL'),
              '승인된 초기 MVP 로그인 ID 정책 이관', 'SUCCEEDED',
              pg_catalog.gen_random_uuid()
            )
          `;
        }
      }
    });
  }

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
    const rows = await sql<
      {
        company_id: string;
        login_name: string | null;
        provider_subject: string | null;
        status: string;
      }[]
    >`
      select app_user.company_id::text,
             app_user.login_name,
             app_user.status,
             identity.provider_subject
      from public.users app_user
      left join public.auth_identities identity
        on identity.company_id = app_user.company_id
       and identity.user_id = app_user.id
       and identity.provider = 'ZITADEL'
      where app_user.id = ${previewUserId}::uuid
    `;
    if (rows.length === 0) return;
    if (
      rows.length !== 1 ||
      rows[0]?.company_id !== previewCompanyId ||
      rows[0].provider_subject !== zitadelSubject ||
      rows[0].status !== "ACTIVE" ||
      !["preview-admin", "previewadmin"].includes(rows[0].login_name ?? "")
    ) {
      fail("Existing Preview bootstrap identity cannot be aligned safely");
    }
    if (rows[0].login_name === "previewadmin") return;
    const collision = await sql<{ exists: boolean }[]>`
      select exists (
        select 1 from public.users
        where lower(btrim(login_name)) = 'previewadmin'
          and id <> ${previewUserId}::uuid
      ) as exists
    `;
    if (collision[0]?.exists) fail("Preview bootstrap canonical login ID is unavailable");
    await sql`
      insert into public.login_id_registry (login_id, company_id, target_user_id)
      values ('previewadmin', ${previewCompanyId}::uuid, ${previewUserId}::uuid)
      on conflict (login_id) do nothing
    `;
    const [registryClaim] = await sql<{ company_id: string; target_user_id: string }[]>`
      select company_id::text, target_user_id::text
      from public.login_id_registry
      where login_id = 'previewadmin'
    `;
    if (
      registryClaim?.company_id !== previewCompanyId ||
      registryClaim.target_user_id !== previewUserId
    ) {
      fail("Preview bootstrap canonical login ID registry claim is unavailable");
    }
    await sql`
      update public.users
      set login_name = 'previewadmin',
          version = version + 1,
          updated_at = pg_catalog.statement_timestamp()
      where id = ${previewUserId}::uuid
        and company_id = ${previewCompanyId}::uuid
        and login_name = 'preview-admin'
    `;
    await sql`
      update public.auth_sessions
      set revoked_at = pg_catalog.statement_timestamp(),
          revoke_reason = 'PREVIEW_BOOTSTRAP_LOGIN_ID_ALIGNED',
          session_version = session_version + 1
      where company_id = ${previewCompanyId}::uuid
        and user_id = ${previewUserId}::uuid
        and revoked_at is null
    `;
    await sql`
      insert into public.audit_events (
        id, event_code, actor_user_id, actor_type, session_id, company_id,
        resource_type, resource_id, before_summary, after_summary, reason,
        result, trace_id
      ) values (
        pg_catalog.gen_random_uuid(), 'PREVIEW_BOOTSTRAP_LOGIN_ID_ALIGNED',
        ${previewUserId}::uuid, 'SYSTEM', null, ${previewCompanyId}::uuid,
        'USER', ${previewUserId}::uuid,
        pg_catalog.jsonb_build_object('state', 'LEGACY_NON_CANONICAL'),
        pg_catalog.jsonb_build_object('state', 'MVP_CANONICAL'),
        '승인된 초기 MVP 로그인 ID 정책 이관', 'SUCCEEDED',
        pg_catalog.gen_random_uuid()
      )
    `;
  });

  if (contractPhase) {
    const [contractApplied] = await owner<{ applied: boolean }[]>`
      select exists(
        select 1 from public.schema_migrations
        where version = '0010_global_login_id_contract'
      ) as applied
    `;
    if (!contractApplied?.applied) {
      await owner.unsafe(
        await readFile(
          resolve(migrationDirectory, "0010_global_login_id_contract.sql"),
          "utf8",
        ),
      );
    }
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
      insert into login_id_registry (login_id, company_id, target_user_id)
      values ('previewadmin', ${previewCompanyId}::uuid, ${previewUserId}::uuid)
      on conflict (login_id) do nothing
    `;
    const [seedRegistryClaim] = await sql<{ company_id: string; target_user_id: string }[]>`
      select company_id::text, target_user_id::text
      from login_id_registry
      where login_id = 'previewadmin'
    `;
    if (
      seedRegistryClaim?.company_id !== previewCompanyId ||
      seedRegistryClaim.target_user_id !== previewUserId
    ) {
      fail("Preview bootstrap canonical login ID registry claim is unavailable");
    }
    await sql`
      insert into users (id, company_id, user_type, display_name, status, login_name, email)
      values (
        ${previewUserId}::uuid,
        ${previewCompanyId}::uuid,
        'INTERNAL_STAFF',
        'Preview 관리자',
        'ACTIVE',
        'previewadmin',
        'preview-admin@werehere.invalid'
      )
      on conflict (id) do update
      set login_name = coalesce(users.login_name, excluded.login_name),
          email = coalesce(users.email, excluded.email)
    `;
    const [user] = await sql<
      {
        company_id: string;
        display_name: string;
        status: string;
        login_name: string | null;
        email: string | null;
        user_type: string;
      }[]
    >`
      select company_id::text, display_name, status, user_type, login_name, email
      from users
      where id = ${previewUserId}::uuid
    `;
    if (
      user?.company_id !== previewCompanyId ||
      user.display_name !== "Preview 관리자" ||
      user.login_name !== "previewadmin" ||
      user.email !== "preview-admin@werehere.invalid" ||
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
    await sql`
      insert into permission_grants (
        id, company_id, branch_id, subject_type, subject_id,
        permission_code, effect, valid_from, valid_until, granted_by, reason
      ) values
      (
        ${previewUserReadGrantId}::uuid, ${previewCompanyId}::uuid, null, 'USER',
        ${previewUserId}::uuid, 'USER_READ', 'ALLOW', '2026-01-01T00:00:00Z'::timestamptz,
        null, ${previewUserId}::uuid, 'Preview 초기 관리자 사용자조회 권한'
      ),
      (
        ${previewUserCreateGrantId}::uuid, ${previewCompanyId}::uuid, null, 'USER',
        ${previewUserId}::uuid, 'USER_CREATE', 'ALLOW', '2026-01-01T00:00:00Z'::timestamptz,
        null, ${previewUserId}::uuid, 'Preview 초기 관리자 사용자생성 권한'
      ),
      (
        ${previewUserSuspendGrantId}::uuid, ${previewCompanyId}::uuid, null, 'USER',
        ${previewUserId}::uuid, 'USER_SUSPEND', 'ALLOW', '2026-01-01T00:00:00Z'::timestamptz,
        null, ${previewUserId}::uuid, 'Preview 초기 관리자 사용자중지 권한'
      )
      on conflict (id) do nothing
    `;
    const accountGrants = await sql<
      {
        branch_id: string | null;
        company_id: string;
        effect: string;
        granted_by: string;
        id: string;
        permission_code: string;
        reason: string;
        subject_id: string;
        subject_type: string;
        valid_from: string;
        valid_until: string | null;
        version: number;
      }[]
    >`
      select id::text, company_id::text, branch_id::text, subject_type,
             subject_id::text, permission_code, effect,
             to_char(valid_from at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as valid_from,
             valid_until::text, granted_by::text, reason, version
      from permission_grants
      where id in (
        ${previewUserReadGrantId}::uuid,
        ${previewUserCreateGrantId}::uuid,
        ${previewUserSuspendGrantId}::uuid
      )
    `;
    const expectedAccountGrants = new Map([
      [
        "USER_READ",
        {
          id: previewUserReadGrantId,
          reason: "Preview 초기 관리자 사용자조회 권한",
        },
      ],
      [
        "USER_CREATE",
        {
          id: previewUserCreateGrantId,
          reason: "Preview 초기 관리자 사용자생성 권한",
        },
      ],
      [
        "USER_SUSPEND",
        {
          id: previewUserSuspendGrantId,
          reason: "Preview 초기 관리자 사용자중지 권한",
        },
      ],
    ]);
    if (
      accountGrants.length !== expectedAccountGrants.size ||
      accountGrants.some((accountGrant) => {
        const expected = expectedAccountGrants.get(
          accountGrant.permission_code,
        );
        return (
          !expected ||
          accountGrant.id !== expected.id ||
          accountGrant.company_id !== previewCompanyId ||
          accountGrant.branch_id !== null ||
          accountGrant.subject_type !== "USER" ||
          accountGrant.subject_id !== previewUserId ||
          accountGrant.effect !== "ALLOW" ||
          accountGrant.valid_from !== "2026-01-01T00:00:00Z" ||
          accountGrant.valid_until !== null ||
          accountGrant.granted_by !== previewUserId ||
          accountGrant.reason !== expected.reason ||
          accountGrant.version !== 1
        );
      })
    ) {
      fail(
        "Existing Preview account permission grants do not match the approved seed",
      );
    }
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
    await sql`
      insert into company_bootstrap_states (
        company_id, bootstrapped_user_id, subject_fingerprint,
        zitadel_organization_id, approval_reference
      ) values (
        ${previewCompanyId}::uuid, ${previewUserId}::uuid, ${actualSubjectFingerprint},
        ${zitadelOrganizationId}, ${bootstrapApprovalReference}
      )
      on conflict (company_id) do nothing
    `;
    const [bootstrap] = await sql<
      {
        approval_reference: string;
        bootstrapped_user_id: string;
        subject_fingerprint: string;
        zitadel_organization_id: string;
      }[]
    >`
      select bootstrapped_user_id::text, subject_fingerprint,
             zitadel_organization_id, approval_reference
      from company_bootstrap_states
      where company_id = ${previewCompanyId}::uuid
    `;
    if (
      bootstrap?.bootstrapped_user_id !== previewUserId ||
      bootstrap.subject_fingerprint !== actualSubjectFingerprint ||
      bootstrap.zitadel_organization_id !== zitadelOrganizationId ||
      bootstrap.approval_reference !== bootstrapApprovalReference
    )
      fail(
        "Existing Preview bootstrap marker does not match the approved identity",
      );
    await sql`
      insert into audit_events (
        id, event_code, actor_user_id, actor_type, company_id,
        resource_type, resource_id, reason, after_summary, result, trace_id
      ) values (
        ${previewBootstrapAuditId}::uuid, 'ACCOUNT_BOOTSTRAPPED', null, 'SYSTEM',
        ${previewCompanyId}::uuid, 'USER', ${previewUserId}::uuid,
        ${bootstrapApprovalReference},
        ${sql.json({ subjectFingerprint: actualSubjectFingerprint, zitadelOrganizationId })},
        'SUCCEEDED', ${previewBootstrapAuditId}::uuid
      )
      on conflict (id) do nothing
    `;
    const [bootstrapAudit] = await sql<
      {
        actor_type: string;
        actor_user_id: string | null;
        after_summary: unknown;
        company_id: string;
        event_code: string;
        reason: string | null;
        resource_id: string;
        resource_type: string;
        result: string;
        trace_id: string;
      }[]
    >`
      select event_code, actor_user_id::text, actor_type, company_id::text,
             resource_type, resource_id::text, reason, after_summary,
             result, trace_id::text
      from audit_events where id = ${previewBootstrapAuditId}::uuid
    `;
    const auditSummary =
      bootstrapAudit?.after_summary &&
      typeof bootstrapAudit.after_summary === "object" &&
      !Array.isArray(bootstrapAudit.after_summary)
        ? (bootstrapAudit.after_summary as Record<string, unknown>)
        : null;
    if (
      bootstrapAudit?.event_code !== "ACCOUNT_BOOTSTRAPPED" ||
      bootstrapAudit.actor_user_id !== null ||
      bootstrapAudit.actor_type !== "SYSTEM" ||
      bootstrapAudit.company_id !== previewCompanyId ||
      bootstrapAudit.resource_type !== "USER" ||
      bootstrapAudit.resource_id !== previewUserId ||
      bootstrapAudit.reason !== bootstrapApprovalReference ||
      bootstrapAudit.result !== "SUCCEEDED" ||
      bootstrapAudit.trace_id !== previewBootstrapAuditId ||
      !auditSummary ||
      Object.keys(auditSummary).sort().join(",") !==
        "subjectFingerprint,zitadelOrganizationId" ||
      auditSummary.subjectFingerprint !== actualSubjectFingerprint ||
      auditSummary.zitadelOrganizationId !== zitadelOrganizationId
    ) {
      fail("Existing Preview bootstrap audit does not match the approved seed");
    }
  });
  console.log("PREVIEW_PRINCIPAL_SEEDED");

  const roles = [
    { name: apiRuntimeRole, password: apiRuntimePassword },
    { name: reconcilerRole, password: reconcilerPassword },
  ] as const;
  for (const role of roles) {
    const [state] = await owner<{ exists: boolean }[]>`
      select exists(select 1 from pg_roles where rolname = ${role.name}) as exists
    `;
    if (!state?.exists) {
      const [createRole] = await owner<{ command: string }[]>`
        select format('create role %I login', ${role.name}::text) as command
      `;
      await owner.unsafe(
        createRole?.command ?? fail("Could not build runtime role command"),
      );
    }
    const [secureRole] = await owner<{ command: string }[]>`
      select format(
        'alter role %I login noinherit password %L',
        ${role.name}::text,
        ${role.password}::text
      ) as command
    `;
    await owner.unsafe(
      secureRole?.command ?? fail("Could not secure runtime role"),
    );
  }

  const buildDefinerCommands = async (roleName: string) => {
    const [commands] = await owner<
      { grant_membership: string; revoke_membership: string }[]
    >`
      select format(
               'grant %I to %I with inherit false, set true',
               ${roleName}::text, current_user
             ) as grant_membership,
             format(
               'revoke %I from %I granted by %I',
               ${roleName}::text, current_user, current_user
             ) as revoke_membership
    `;
    return commands ?? fail("Could not build definer membership commands");
  };

  const capabilityDefinerCommands = await buildDefinerCommands(
    "werehere_tenant_authority_definer",
  );
  let capabilityRows: Array<{ capability: string; role_name: string }> = [];
  await owner.begin(async (sql) => {
    await sql.unsafe(capabilityDefinerCommands.grant_membership);
    await sql.unsafe("set local role werehere_tenant_authority_definer");
    await sql`
      insert into runtime_database_capabilities (role_name, capability)
      values (${apiRuntimeRole}, 'API_RUNTIME'), (${reconcilerRole}, 'RECONCILER')
      on conflict (role_name) do update
      set capability = excluded.capability,
          provisioned_at = now()
    `;
    capabilityRows = await sql<{ capability: string; role_name: string }[]>`
      select role_name::text, capability
      from runtime_database_capabilities
      where role_name in (${apiRuntimeRole}, ${reconcilerRole})
      order by role_name
    `;
    await sql.unsafe("reset role");
    await sql.unsafe(capabilityDefinerCommands.revoke_membership);
  });

  const capabilityMap = new Map(
    capabilityRows.map((row) => [row.role_name, row.capability]),
  );
  if (
    capabilityMap.get(apiRuntimeRole) !== "API_RUNTIME" ||
    capabilityMap.get(reconcilerRole) !== "RECONCILER"
  )
    fail("Preview runtime capability registration failed");

  const [legacyRuntimeState] = await owner<
    { compatible_capability: boolean; exists: boolean }[]
  >`
    select exists(
             select 1 from pg_roles where rolname = 'werehere_preview_runtime'
           ) as exists,
           exists(
             select 1
             from public.runtime_database_capabilities
             where role_name = 'werehere_preview_runtime'
               and capability = 'API_RUNTIME'
           ) as compatible_capability
  `;
  const legacyCompatibilityGrant =
    !contractPhase &&
    legacyRuntimeState?.exists &&
    legacyRuntimeState.compatible_capability
      ? ", werehere_preview_runtime"
      : "";
  const legacyPolicyGrant =
    contractPhase && legacyRuntimeState?.exists
      ? ", werehere_preview_runtime"
      : "";
  const apiRuntimeTableGrantees = `${apiRuntimeRole}${legacyCompatibilityGrant}`;

  if (contractPhase && legacyRuntimeState?.exists) {
    await owner.unsafe(`
      revoke all privileges on all tables in schema public from werehere_preview_runtime;
      revoke all privileges on all sequences in schema public from werehere_preview_runtime;
      revoke all on schema public from werehere_preview_runtime;
    `);
  }

  const [sequenceOwnerTopology] = await owner<{ unexpected_count: number }[]>`
    select count(*)::integer as unexpected_count
    from pg_class sequence_record
    join pg_namespace sequence_namespace
      on sequence_namespace.oid = sequence_record.relnamespace
    join pg_class migration_table
      on migration_table.relname = 'schema_migrations'
     and migration_table.relnamespace = sequence_record.relnamespace
    where sequence_namespace.nspname = 'public'
      and sequence_record.relkind = 'S'
      and sequence_record.relowner <> migration_table.relowner
  `;
  if (!sequenceOwnerTopology || sequenceOwnerTopology.unexpected_count !== 0) {
    fail("Preview public sequence ownership is not canonical");
  }

  await owner.begin(async (sql) => {
    await sql.unsafe(capabilityDefinerCommands.grant_membership);
    await sql.unsafe("set local role werehere_tenant_authority_definer");
    await sql.unsafe(`
      do $tenant_owned_table_acl_reset$
      declare
        acl_record record;
      begin
        for acl_record in
          select distinct table_namespace.nspname as schema_name,
                 table_record.relname as table_name,
                 acl.grantee,
                 grantee_role.rolname as grantee_name
          from pg_class table_record
          join pg_namespace table_namespace
            on table_namespace.oid = table_record.relnamespace
          cross join lateral aclexplode(coalesce(
            table_record.relacl,
            acldefault('r'::"char", table_record.relowner)
          )) acl
          left join pg_roles grantee_role on grantee_role.oid = acl.grantee
          where table_namespace.nspname = 'public'
            and table_record.relkind in ('r', 'p')
            and table_record.relowner = current_user::regrole::oid
            and acl.grantee <> table_record.relowner
        loop
          if acl_record.grantee = 0::oid then
            execute format(
              'revoke all privileges on table %I.%I from public cascade',
              acl_record.schema_name,
              acl_record.table_name
            );
          else
            execute format(
              'revoke all privileges on table %I.%I from %I cascade',
              acl_record.schema_name,
              acl_record.table_name,
              acl_record.grantee_name
            );
          end if;
        end loop;
      end
      $tenant_owned_table_acl_reset$;

      grant select, insert, update on public.runtime_database_capabilities
        to session_user;
      grant select on public.runtime_database_capabilities
        to werehere_auth_session_definer;
    `);
    await sql.unsafe("reset role");
    await sql.unsafe(capabilityDefinerCommands.revoke_membership);
  });

  await owner.unsafe(`
    do $migration_owned_table_acl_reset$
    declare
      acl_record record;
    begin
      for acl_record in
        select distinct table_namespace.nspname as schema_name,
               table_record.relname as table_name,
               acl.grantee,
               grantee_role.rolname as grantee_name
        from pg_class table_record
        join pg_namespace table_namespace
          on table_namespace.oid = table_record.relnamespace
        cross join lateral aclexplode(coalesce(
          table_record.relacl,
          acldefault('r'::"char", table_record.relowner)
        )) acl
        left join pg_roles grantee_role on grantee_role.oid = acl.grantee
        where table_namespace.nspname = 'public'
          and table_record.relkind in ('r', 'p')
          and table_record.relowner = current_user::regrole::oid
          and acl.grantee <> table_record.relowner
      loop
        if acl_record.grantee = 0::oid then
          execute format(
            'revoke all privileges on table %I.%I from public cascade',
            acl_record.schema_name,
            acl_record.table_name
          );
        else
          execute format(
            'revoke all privileges on table %I.%I from %I cascade',
            acl_record.schema_name,
            acl_record.table_name,
            acl_record.grantee_name
          );
        end if;
      end loop;
    end
    $migration_owned_table_acl_reset$;

    revoke create on schema public from public;
    ${contractPhase ? "revoke usage on schema public from public;" : "grant usage on schema public to public;"}

    do $schema_acl_reset$
    declare
      acl_record record;
    begin
      for acl_record in
        select distinct grantee_role.rolname as grantee_name
        from pg_namespace namespace_record
        cross join lateral aclexplode(coalesce(
          namespace_record.nspacl,
          acldefault('n'::"char", namespace_record.nspowner)
        )) acl
        join pg_roles grantee_role on grantee_role.oid = acl.grantee
        where namespace_record.nspname = 'public'
          and acl.grantee <> namespace_record.nspowner
          and grantee_role.rolname not in (
            'werehere_auth_session_definer',
            'werehere_tenant_authority_definer'
          )
          and not exists (
            select 1
            from public.runtime_database_capabilities capability
            where capability.role_name = grantee_role.rolname
          )
      loop
        execute format(
          'revoke all privileges on schema public from %I cascade',
          acl_record.grantee_name
        );
      end loop;
    end
    $schema_acl_reset$;

    do $sequence_acl_reset$
    declare
      acl_record record;
    begin
      for acl_record in
        select sequence_namespace.nspname as schema_name,
               sequence_record.relname as sequence_name,
               acl.grantee,
               grantee_role.rolname as grantee_name
        from pg_class sequence_record
        join pg_namespace sequence_namespace
          on sequence_namespace.oid = sequence_record.relnamespace
        cross join lateral aclexplode(coalesce(
          sequence_record.relacl,
          acldefault('S'::"char", sequence_record.relowner)
        )) acl
        left join pg_roles grantee_role on grantee_role.oid = acl.grantee
        where sequence_namespace.nspname = 'public'
          and sequence_record.relkind = 'S'
          and acl.grantee <> sequence_record.relowner
      loop
        if acl_record.grantee = 0::oid then
          execute format(
            'revoke all privileges on sequence %I.%I from public cascade',
            acl_record.schema_name,
            acl_record.sequence_name
          );
        else
          execute format(
            'revoke all privileges on sequence %I.%I from %I cascade',
            acl_record.schema_name,
            acl_record.sequence_name,
            acl_record.grantee_name
          );
        end if;
      end loop;
    end
    $sequence_acl_reset$;

    revoke all privileges on all tables in schema public from ${apiRuntimeRole};
    revoke all privileges on all tables in schema public from ${reconcilerRole};
    revoke all privileges on all sequences in schema public from ${apiRuntimeRole};
    revoke all privileges on all sequences in schema public from ${reconcilerRole};
    revoke all on schema public from ${apiRuntimeRole};
    revoke all on schema public from ${reconcilerRole};
    grant usage on schema public to ${apiRuntimeRole};
    grant usage on schema public to ${reconcilerRole};
    grant execute on function public.jsonb_reject_plaintext_password_keys(jsonb)
      to ${apiRuntimeRole}, ${reconcilerRole};

    grant select, update on auth_identities, users, companies
      to werehere_auth_session_definer;
    grant select, insert, update on auth_sessions
      to werehere_auth_session_definer;
    grant insert on audit_events to werehere_auth_session_definer;

    grant select on auth_sessions, users, companies, reconciliation_company_registry
      to werehere_tenant_authority_definer;
    grant insert, update on reconciliation_company_registry
      to werehere_tenant_authority_definer;

    grant select on
      companies, users, auth_identities, auth_sessions, runtime_database_capabilities,
      auth_login_transactions, auth_credential_rate_limits,
      schema_migrations, roles, permissions, user_role_memberships,
      user_groups, user_group_memberships, permission_grants,
      branches, hotel_profiles, idempotency_records, outbox_jobs,
      account_provisioning_attempts, initial_password_change_attempts, login_id_registry,
      hotel_staff_assignments,
      housekeeping_hotel_links, hotel_owner_assignments
    to ${apiRuntimeTableGrantees};
    grant insert, update, delete on auth_login_transactions to ${apiRuntimeTableGrantees};
    grant insert, update, delete on auth_credential_rate_limits to ${apiRuntimeTableGrantees};

    grant insert on audit_events, branches, hotel_profiles, auth_identities,
      hotel_staff_assignments, housekeeping_hotel_links, hotel_owner_assignments
    to ${apiRuntimeTableGrantees};
    grant insert, update on users, account_provisioning_attempts,
      initial_password_change_attempts to ${apiRuntimeTableGrantees};
    grant insert on login_id_registry to ${apiRuntimeTableGrantees};
    grant insert, update, delete on idempotency_records to ${apiRuntimeTableGrantees};
    grant insert, update on outbox_jobs to ${apiRuntimeTableGrantees};

    grant select on
      schema_migrations, companies, permissions, users, auth_identities, branches, hotel_profiles,
      runtime_database_capabilities, outbox_jobs, account_provisioning_attempts,
      hotel_staff_assignments, housekeeping_hotel_links, hotel_owner_assignments
    to ${reconcilerRole};
    grant insert on users, auth_identities, audit_events, outbox_jobs,
      hotel_staff_assignments, housekeeping_hotel_links, hotel_owner_assignments
    to ${reconcilerRole};
    grant update on account_provisioning_attempts, outbox_jobs to ${reconcilerRole};
  `);

  await updateLocalCiDefinerMembership(
    migrationOwnerIdentity.role_name,
    "GRANT",
  );
  const authDefinerCommands = await buildDefinerCommands(
    "werehere_auth_session_definer",
  );
  await owner.begin(async (sql) => {
    await sql.unsafe(authDefinerCommands.grant_membership);
    await sql.unsafe("set local role werehere_auth_session_definer");
    await sql.unsafe(`
      do $exact_auth_acl$
      declare
        acl_record record;
      begin
        for acl_record in
          select procedure_record.oid::regprocedure::text as signature,
                 grantee_role.rolname as grantee
          from pg_catalog.pg_proc procedure_record
          join pg_catalog.pg_namespace procedure_namespace
            on procedure_namespace.oid = procedure_record.pronamespace
          cross join lateral pg_catalog.aclexplode(coalesce(
            procedure_record.proacl,
            pg_catalog.acldefault('f'::"char", procedure_record.proowner)
          )) acl
          join pg_catalog.pg_roles grantee_role on grantee_role.oid = acl.grantee
          where procedure_namespace.nspname = 'public'
            and procedure_record.proname in (
              'auth_create_session_v2',
              'auth_resolve_login_identity_v1',
              'auth_resolve_principal_v2',
              'auth_revoke_session_v2',
              'auth_revoke_user_sessions_v1'
            )
            and acl.privilege_type = 'EXECUTE'
            and acl.grantee <> procedure_record.proowner
        loop
          execute pg_catalog.format(
            'revoke all privileges on function %s from %I cascade',
            acl_record.signature,
            acl_record.grantee
          );
        end loop;
      end
      $exact_auth_acl$;
      revoke all privileges on function public.auth_create_session_v2(
        uuid, bytea, text, integer, integer, timestamptz, uuid
      ), public.auth_resolve_login_identity_v1(text),
        public.auth_resolve_principal_v2(bytea, integer),
        public.auth_revoke_session_v2(bytea, text, uuid),
        public.auth_revoke_user_sessions_v1(uuid, uuid, text)
        from public;
      revoke grant option for execute on function public.auth_create_session_v2(
        uuid, bytea, text, integer, integer, timestamptz, uuid
      ), public.auth_resolve_login_identity_v1(text),
        public.auth_resolve_principal_v2(bytea, integer),
        public.auth_revoke_session_v2(bytea, text, uuid),
        public.auth_revoke_user_sessions_v1(uuid, uuid, text)
        from ${apiRuntimeRole}, ${reconcilerRole} cascade;
      grant execute on function public.auth_create_session_v2(
        uuid, bytea, text, integer, integer, timestamptz, uuid
      ) to ${apiRuntimeRole};
      grant execute on function public.auth_resolve_login_identity_v1(text)
        to ${apiRuntimeRole};
      grant execute on function public.auth_resolve_principal_v2(bytea, integer)
        to ${apiRuntimeRole};
      grant execute on function public.auth_revoke_session_v2(bytea, text, uuid)
        to ${apiRuntimeRole};
      grant execute on function public.auth_revoke_user_sessions_v1(uuid, uuid, text)
        to ${apiRuntimeRole};
      revoke execute on function public.auth_create_session_v2(
        uuid, bytea, text, integer, integer, timestamptz, uuid
      ) from ${reconcilerRole};
      revoke execute on function public.auth_resolve_login_identity_v1(text)
        from ${reconcilerRole};
      revoke execute on function public.auth_resolve_principal_v2(bytea, integer)
        from ${reconcilerRole};
      revoke execute on function public.auth_revoke_session_v2(bytea, text, uuid)
        from ${reconcilerRole};
      revoke execute on function public.auth_revoke_user_sessions_v1(uuid, uuid, text)
        from ${reconcilerRole}${legacyPolicyGrant};
      ${
        contractPhase && legacyRuntimeState?.exists
          ? `
      revoke execute on function public.auth_create_session_v2(
        uuid, bytea, text, integer, integer, timestamptz, uuid
      ) from werehere_preview_runtime;
      revoke execute on function public.auth_resolve_login_identity_v1(text)
        from werehere_preview_runtime;
      revoke execute on function public.auth_resolve_principal_v2(bytea, integer)
        from werehere_preview_runtime;
      revoke execute on function public.auth_revoke_session_v2(bytea, text, uuid)
        from werehere_preview_runtime;
      revoke execute on function public.auth_revoke_user_sessions_v1(uuid, uuid, text)
        from werehere_preview_runtime;
      `
          : ""
      }
    `);
    await sql.unsafe("reset role");
    await sql.unsafe(authDefinerCommands.revoke_membership);
  });

  const tenantDefinerCommands = await buildDefinerCommands(
    "werehere_tenant_authority_definer",
  );
  await owner.begin(async (sql) => {
    await sql.unsafe(tenantDefinerCommands.grant_membership);
    await sql.unsafe("set local role werehere_tenant_authority_definer");
    await sql.unsafe(`
      do $exact_tenant_acl$
      declare
        acl_record record;
      begin
        for acl_record in
          select procedure_record.oid::regprocedure::text as signature,
                 grantee_role.rolname as grantee
          from pg_catalog.pg_proc procedure_record
          join pg_catalog.pg_namespace procedure_namespace
            on procedure_namespace.oid = procedure_record.pronamespace
          cross join lateral pg_catalog.aclexplode(coalesce(
            procedure_record.proacl,
            pg_catalog.acldefault('f'::"char", procedure_record.proowner)
          )) acl
          join pg_catalog.pg_roles grantee_role on grantee_role.oid = acl.grantee
          where procedure_namespace.nspname = 'public'
            and procedure_record.proname in (
              'runtime_is_schema_owner',
              'runtime_has_capability',
              'api_current_company_id',
              'reconciler_current_company_id',
              'sync_reconciliation_company_registry',
              'reconciliation_company_ids'
            )
            and acl.privilege_type = 'EXECUTE'
            and acl.grantee <> procedure_record.proowner
        loop
          execute pg_catalog.format(
            'revoke all privileges on function %s from %I cascade',
            acl_record.signature,
            acl_record.grantee
          );
        end loop;
      end
      $exact_tenant_acl$;
      revoke all privileges on function public.runtime_is_schema_owner(),
        public.runtime_has_capability(text), public.api_current_company_id(),
        public.reconciler_current_company_id(),
        public.sync_reconciliation_company_registry(),
        public.reconciliation_company_ids()
        from public;
      revoke grant option for execute on function public.runtime_is_schema_owner(),
        public.runtime_has_capability(text), public.api_current_company_id(),
        public.reconciler_current_company_id(), public.reconciliation_company_ids()
        from ${apiRuntimeRole}, ${reconcilerRole} cascade;
      grant select on public.runtime_database_capabilities
        to ${apiRuntimeRole}, ${reconcilerRole}${legacyCompatibilityGrant};
      grant execute on function public.runtime_is_schema_owner(),
        public.runtime_has_capability(text), public.api_current_company_id(),
        public.reconciler_current_company_id()
        to werehere_auth_session_definer, ${migrationOwnerIdentity.role_identifier};
      grant execute on function public.runtime_is_schema_owner()
        to ${apiRuntimeRole}, ${reconcilerRole}${legacyCompatibilityGrant};
      grant execute on function public.runtime_has_capability(text)
        to ${apiRuntimeRole}, ${reconcilerRole}${legacyCompatibilityGrant};
      grant execute on function public.api_current_company_id(),
        public.reconciler_current_company_id()
        to ${apiRuntimeRole}, ${reconcilerRole}${legacyCompatibilityGrant};
      grant execute on function public.reconciliation_company_ids() to ${reconcilerRole};
      revoke execute on function public.reconciliation_company_ids() from ${apiRuntimeRole};
      ${
        contractPhase && legacyRuntimeState?.exists
          ? `
      revoke execute on function public.runtime_is_schema_owner(),
        public.runtime_has_capability(text),
        public.api_current_company_id(),
        public.reconciler_current_company_id(),
        public.reconciliation_company_ids()
        from werehere_preview_runtime;
      delete from public.runtime_database_capabilities
        where role_name = 'werehere_preview_runtime';
      `
          : ""
      }
    `);
    await sql.unsafe("reset role");
    await sql.unsafe(tenantDefinerCommands.revoke_membership);
  });

  if (contractPhase && legacyRuntimeState?.exists) {
    const [legacyAccess] = await owner<
      { capability: boolean; schema_access: boolean; object_acl: boolean }[]
    >`
      select
        exists (
          select 1 from public.runtime_database_capabilities
          where role_name = 'werehere_preview_runtime'
        ) as capability,
        (
          has_schema_privilege('werehere_preview_runtime', 'public', 'USAGE')
          or has_schema_privilege('werehere_preview_runtime', 'public', 'CREATE')
        ) as schema_access,
        exists (
          select 1
          from pg_class object_record
          join pg_namespace object_namespace on object_namespace.oid = object_record.relnamespace
          cross join lateral aclexplode(coalesce(
            object_record.relacl,
            acldefault(case when object_record.relkind = 'S' then 'S'::"char" else 'r'::"char" end, object_record.relowner)
          )) acl
          join pg_roles grantee_role on grantee_role.oid = acl.grantee
          where object_namespace.nspname = 'public'
            and object_record.relkind in ('r', 'p', 'S')
            and grantee_role.rolname = 'werehere_preview_runtime'
        ) as object_acl
    `;
    const residualAccess = legacyAccess
      ? Object.entries(legacyAccess)
          .filter(([, present]) => present)
          .map(([label]) => label)
      : ["verification_missing"];
    if (residualAccess.length > 0) {
      fail(
        `Legacy Preview runtime access was not fully revoked: ${residualAccess.join(",")}`,
      );
    }
  }

  await updateLocalCiDefinerMembership(
    migrationOwnerIdentity.role_name,
    "REVOKE",
  );
  localCiMembershipCleanupRequired = false;

  const definerMembershipSafety = await owner<
    {
      admin_option: boolean;
      definer_role: string;
      grantor_role: string;
      inherit_option: boolean;
      member_role: string;
      set_option: boolean;
    }[]
  >`
    select definer_role.rolname as definer_role,
           member_role.rolname as member_role,
           grantor_role.rolname as grantor_role,
           membership.inherit_option,
           membership.set_option,
           membership.admin_option
    from pg_auth_members membership
    join pg_roles definer_role on definer_role.oid = membership.roleid
    join pg_roles member_role on member_role.oid = membership.member
    join pg_roles grantor_role on grantor_role.oid = membership.grantor
    where definer_role.rolname in (
      'werehere_auth_session_definer',
      'werehere_tenant_authority_definer'
    )
      and (membership.inherit_option or membership.set_option or membership.admin_option)
  `;
  if (definerMembershipSafety.length !== 0) {
    fail("Preview definer membership cleanup failed");
  }

  for (const role of roles) {
    const [safety] = await owner<
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
      where runtime_role.rolname = ${role.name}
    `;
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
    )
      fail("Preview runtime role safety verification failed");
  }

  const apiRuntimeUrl = new URL(previewUrl);
  apiRuntimeUrl.username = apiRuntimeRole;
  apiRuntimeUrl.password = apiRuntimePassword;
  const reconcilerUrl = new URL(previewUrl);
  reconcilerUrl.username = reconcilerRole;
  reconcilerUrl.password = reconcilerPassword;
  await writeFile(apiOutputFile, apiRuntimeUrl.toString(), { mode: 0o600 });
  await chmod(apiOutputFile, 0o600);
  await writeFile(reconcilerOutputFile, reconcilerUrl.toString(), {
    mode: 0o600,
  });
  await chmod(reconcilerOutputFile, 0o600);

  const apiReadiness = await probeDatabaseReadiness(apiRuntimeUrl.toString(), {
    capability: "API_RUNTIME",
    requiredSchemaPhase: provisionPhase,
  });
  if (apiReadiness.status !== "READY") {
    fail(
      `Preview API runtime readiness failed in ${provisionPhase}: ${apiReadiness.status}`,
    );
  }
  const reconcilerReadiness = await probeDatabaseReadiness(
    reconcilerUrl.toString(),
    {
      capability: "RECONCILER",
      requiredSchemaPhase: provisionPhase,
    },
  );
  if (reconcilerReadiness.status !== "READY") {
    fail(`Preview reconciler readiness failed: ${reconcilerReadiness.status}`);
  }

  console.log("PREVIEW_DATABASE_PROVISIONED");
  console.log(`PREVIEW_DATABASE_PHASE_${provisionPhase}`);
  console.log("PREVIEW_API_RUNTIME_ROLE_READY");
  console.log("PREVIEW_RECONCILER_ROLE_READY");
} finally {
  try {
    if (localCiMembershipCleanupRequired && migrationOwnerRoleForCleanup) {
      await updateLocalCiDefinerMembership(
        migrationOwnerRoleForCleanup,
        "REVOKE",
      );
    }
  } finally {
    await owner.end({ timeout: 2 });
  }
}
