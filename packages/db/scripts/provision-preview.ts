import { chmod, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import postgres from "postgres";
import { probeDatabaseReadiness } from "../src/client";

const ownerDatabaseUrl = process.env.DATABASE_URL_PREVIEW?.trim() ?? "";
const productionDatabaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const apiRuntimePassword = process.env.DATABASE_API_RUNTIME_PASSWORD_PREVIEW ?? "";
const reconcilerPassword = process.env.DATABASE_RECONCILER_PASSWORD_PREVIEW ?? "";
const apiOutputFile = process.env.API_RUNTIME_DATABASE_URL_FILE?.trim() ?? "";
const reconcilerOutputFile = process.env.RECONCILER_DATABASE_URL_FILE?.trim() ?? "";
const zitadelSubject = process.env.ZITADEL_PREVIEW_SUBJECT?.trim() ?? "";
const approvedSubjectFingerprint = process.env.ZITADEL_PREVIEW_SUBJECT_SHA256?.trim().toLowerCase() ?? "";
const zitadelOrganizationId = process.env.ZITADEL_PREVIEW_ORGANIZATION_ID?.trim() ?? "";
const bootstrapApprovalReference = process.env.PREVIEW_BOOTSTRAP_APPROVAL_REF?.trim() ?? "";
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
if (!apiRuntimePassword) fail("DATABASE_API_RUNTIME_PASSWORD_PREVIEW is required");
if (!reconcilerPassword) fail("DATABASE_RECONCILER_PASSWORD_PREVIEW is required");
if (apiRuntimePassword === reconcilerPassword) fail("Preview runtime passwords must differ");
if (!apiOutputFile) fail("API_RUNTIME_DATABASE_URL_FILE is required");
if (!reconcilerOutputFile) fail("RECONCILER_DATABASE_URL_FILE is required");
if (!zitadelSubject) fail("ZITADEL_PREVIEW_SUBJECT is required");
if (!/^[0-9a-f]{64}$/u.test(approvedSubjectFingerprint)) fail("ZITADEL_PREVIEW_SUBJECT_SHA256 is required");
const actualSubjectFingerprint = createHash("sha256").update(zitadelSubject, "utf8").digest("hex");
if (actualSubjectFingerprint !== approvedSubjectFingerprint) fail("ZITADEL Preview subject fingerprint mismatch");
if (!zitadelOrganizationId) fail("ZITADEL_PREVIEW_ORGANIZATION_ID is required");
if (!bootstrapApprovalReference) fail("PREVIEW_BOOTSTRAP_APPROVAL_REF is required");

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
  if (!identity[0] || [apiRuntimeRole, reconcilerRole].includes(identity[0].current_user)) {
    fail("Preview migration credential must differ from both runtime roles");
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
    ["0004_custom_login_security", "0004_custom_login_security.sql"],
    ["0005_auth_session_definer", "0005_auth_session_definer.sql"],
    ["0006_account_administration", "0006_account_administration.sql"],
    ["0007_api_tenant_authority_expand", "0007_api_tenant_authority_expand.sql"],
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
      insert into users (id, company_id, user_type, display_name, status, login_name, email)
      values (
        ${previewUserId}::uuid,
        ${previewCompanyId}::uuid,
        'INTERNAL_STAFF',
        'Preview 관리자',
        'ACTIVE',
        'preview-admin',
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
      user.login_name !== "preview-admin" ||
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
    const [accountGrantCount] = await sql<{ grant_count: number }[]>`
      select count(*)::int as grant_count
      from permission_grants
      where company_id = ${previewCompanyId}::uuid
        and subject_type = 'USER'
        and subject_id = ${previewUserId}::uuid
        and branch_id is null
        and permission_code in ('USER_READ', 'USER_CREATE', 'USER_SUSPEND')
        and effect = 'ALLOW'
        and valid_until is null
    `;
    if (accountGrantCount?.grant_count !== 3) {
      fail("Preview account management permission grants are unavailable");
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
    const [bootstrap] = await sql<{
      approval_reference: string;
      bootstrapped_user_id: string;
      subject_fingerprint: string;
      zitadel_organization_id: string;
    }[]>`
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
    ) fail("Existing Preview bootstrap marker does not match the approved identity");
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
    const [bootstrapAudit] = await sql<{ event_code: string }[]>`
      select event_code from audit_events where id = ${previewBootstrapAuditId}::uuid
    `;
    if (bootstrapAudit?.event_code !== "ACCOUNT_BOOTSTRAPPED") fail("Preview bootstrap audit is unavailable");
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
      await owner.unsafe(createRole?.command ?? fail("Could not build runtime role command"));
    }
    const [secureRole] = await owner<{ command: string }[]>`
      select format(
        'alter role %I login noinherit password %L',
        ${role.name}::text,
        ${role.password}::text
      ) as command
    `;
    await owner.unsafe(secureRole?.command ?? fail("Could not secure runtime role"));
  }

  const buildDefinerCommands = async (roleName: string) => {
    const [commands] = await owner<{ grant_membership: string; revoke_membership: string }[]>`
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

  const capabilityDefinerCommands = await buildDefinerCommands("werehere_tenant_authority_definer");
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

  const capabilityMap = new Map(capabilityRows.map((row) => [row.role_name, row.capability]));
  if (
    capabilityMap.get(apiRuntimeRole) !== "API_RUNTIME"
    || capabilityMap.get(reconcilerRole) !== "RECONCILER"
  ) fail("Preview runtime capability registration failed");

  const [legacyRuntimeState] = await owner<{ exists: boolean }[]>`
    select exists(
      select 1 from pg_roles where rolname = 'werehere_preview_runtime'
    ) as exists
  `;
  const legacyPolicyGrant = legacyRuntimeState?.exists ? ", werehere_preview_runtime" : "";

  await owner.unsafe(`
    revoke all privileges on all tables in schema public from ${apiRuntimeRole};
    revoke all privileges on all tables in schema public from ${reconcilerRole};
    revoke create on schema public from ${apiRuntimeRole};
    revoke create on schema public from ${reconcilerRole};
    grant usage on schema public to ${apiRuntimeRole};
    grant usage on schema public to ${reconcilerRole};
    grant execute on function public.jsonb_reject_plaintext_password_keys(jsonb)
      to ${apiRuntimeRole}, ${reconcilerRole};

    grant select on
      companies, users, auth_identities,
      auth_login_transactions, auth_credential_rate_limits,
      schema_migrations, roles, permissions, user_role_memberships,
      user_groups, user_group_memberships, permission_grants,
      branches, hotel_profiles, idempotency_records, outbox_jobs,
      account_provisioning_attempts, initial_password_change_attempts, hotel_staff_assignments,
      housekeeping_hotel_links, hotel_owner_assignments
    to ${apiRuntimeRole};
    grant insert, update, delete on auth_login_transactions to ${apiRuntimeRole};
    grant insert, update, delete on auth_credential_rate_limits to ${apiRuntimeRole};

    grant insert on audit_events, branches, hotel_profiles, auth_identities,
      hotel_staff_assignments, housekeeping_hotel_links, hotel_owner_assignments
    to ${apiRuntimeRole};
    grant insert, update on users, account_provisioning_attempts,
      initial_password_change_attempts to ${apiRuntimeRole};
    grant insert, update, delete on idempotency_records to ${apiRuntimeRole};
    grant insert, update on outbox_jobs to ${apiRuntimeRole};

    grant select on
      schema_migrations, companies, permissions, users, auth_identities, branches, hotel_profiles,
      outbox_jobs, account_provisioning_attempts,
      hotel_staff_assignments, housekeeping_hotel_links, hotel_owner_assignments
    to ${reconcilerRole};
    grant insert on users, auth_identities, audit_events, outbox_jobs,
      hotel_staff_assignments, housekeeping_hotel_links, hotel_owner_assignments
    to ${reconcilerRole};
    grant update on account_provisioning_attempts, outbox_jobs to ${reconcilerRole};
  `);

  const authDefinerCommands = await buildDefinerCommands("werehere_auth_session_definer");
  await owner.begin(async (sql) => {
    await sql.unsafe(authDefinerCommands.grant_membership);
    await sql.unsafe("set local role werehere_auth_session_definer");
    await sql.unsafe(`
      revoke execute on function public.auth_create_session(
        uuid, bytea, text, integer, integer, timestamptz, uuid
      ) from ${apiRuntimeRole}, ${reconcilerRole};
      grant execute on function public.auth_create_session_v2(
        uuid, bytea, text, integer, integer, timestamptz, uuid
      ) to ${apiRuntimeRole};
      grant execute on function public.auth_resolve_principal_v2(bytea, integer)
        to ${apiRuntimeRole};
      grant execute on function public.auth_revoke_session_v2(bytea, text, uuid)
        to ${apiRuntimeRole};
      revoke execute on function public.auth_create_session_v2(
        uuid, bytea, text, integer, integer, timestamptz, uuid
      ) from ${reconcilerRole};
      revoke execute on function public.auth_resolve_principal_v2(bytea, integer)
        from ${reconcilerRole};
      revoke execute on function public.auth_revoke_session_v2(bytea, text, uuid)
        from ${reconcilerRole};
    `);
    await sql.unsafe("reset role");
    await sql.unsafe(authDefinerCommands.revoke_membership);
  });

  const tenantDefinerCommands = await buildDefinerCommands("werehere_tenant_authority_definer");
  await owner.begin(async (sql) => {
    await sql.unsafe(tenantDefinerCommands.grant_membership);
    await sql.unsafe("set local role werehere_tenant_authority_definer");
    await sql.unsafe(`
      grant execute on function public.runtime_is_schema_owner()
        to ${apiRuntimeRole}, ${reconcilerRole}${legacyPolicyGrant};
      grant execute on function public.runtime_has_capability(text)
        to ${apiRuntimeRole}, ${reconcilerRole}${legacyPolicyGrant};
      grant execute on function public.api_current_company_id(),
        public.reconciler_current_company_id()
        to ${apiRuntimeRole}, ${reconcilerRole}${legacyPolicyGrant};
      grant execute on function public.reconciliation_company_ids() to ${reconcilerRole};
      revoke execute on function public.reconciliation_company_ids() from ${apiRuntimeRole};
    `);
    await sql.unsafe("reset role");
    await sql.unsafe(tenantDefinerCommands.revoke_membership);
  });

  for (const role of roles) {
    const [safety] = await owner<{
      bypass_rls: boolean;
      creates_databases: boolean;
      creates_roles: boolean;
      has_memberships: boolean;
      inherits_roles: boolean;
      owns_public_table: boolean;
      replicates: boolean;
      superuser: boolean;
    }[]>`
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
      !safety
      || safety.superuser
      || safety.bypass_rls
      || safety.creates_databases
      || safety.creates_roles
      || safety.has_memberships
      || safety.inherits_roles
      || safety.owns_public_table
      || safety.replicates
    ) fail("Preview runtime role safety verification failed");
  }

  const apiRuntimeUrl = new URL(previewUrl);
  apiRuntimeUrl.username = apiRuntimeRole;
  apiRuntimeUrl.password = apiRuntimePassword;
  const reconcilerUrl = new URL(previewUrl);
  reconcilerUrl.username = reconcilerRole;
  reconcilerUrl.password = reconcilerPassword;
  await writeFile(apiOutputFile, apiRuntimeUrl.toString(), { mode: 0o600 });
  await chmod(apiOutputFile, 0o600);
  await writeFile(reconcilerOutputFile, reconcilerUrl.toString(), { mode: 0o600 });
  await chmod(reconcilerOutputFile, 0o600);

  const apiReadiness = await probeDatabaseReadiness(apiRuntimeUrl.toString(), {
    capability: "API_RUNTIME",
  });
  if (apiReadiness.status !== "READY") {
    fail(`Preview API runtime readiness failed: ${apiReadiness.status}`);
  }
  const reconcilerReadiness = await probeDatabaseReadiness(reconcilerUrl.toString(), {
    capability: "RECONCILER",
  });
  if (reconcilerReadiness.status !== "READY") {
    fail(`Preview reconciler readiness failed: ${reconcilerReadiness.status}`);
  }

  console.log("PREVIEW_DATABASE_PROVISIONED");
  console.log("PREVIEW_API_RUNTIME_ROLE_READY");
  console.log("PREVIEW_RECONCILER_ROLE_READY");
} finally {
  await owner.end({ timeout: 2 });
}
