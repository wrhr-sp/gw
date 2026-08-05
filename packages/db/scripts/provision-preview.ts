import { chmod, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import postgres from "postgres";
import { loginIdSchema } from "@werehere/contracts";
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
const previewHotelAssignmentGrantId = "73000000-0000-4000-8000-000000000005";
const previewHotelOwnerGrantId = "73000000-0000-4000-8000-000000000006";
const previewHotelStatusGrantId = "73000000-0000-4000-8000-000000000007";
const previewHotelRoomReadGrantId = "73000000-0000-4000-8000-000000000008";
const previewHotelRoomManageGrantId = "73000000-0000-4000-8000-000000000009";
const previewHotelRoomTypeManageGrantId =
  "73000000-0000-4000-8000-000000000010";
const previewBootstrapAuditId = "74000000-0000-4000-8000-000000000001";
const localCiTestMode = process.env.PREVIEW_PROVISION_LOCAL_CI_TEST === "1";
const provisionPhase =
  process.env.PREVIEW_PROVISION_PHASE?.trim().toUpperCase() || "CONTRACT";

function fail(message: string): never {
  throw new Error(message);
}

const previewBootstrapLoginIdResult = loginIdSchema.safeParse(
  process.env.PREVIEW_BOOTSTRAP_LOGIN_ID?.trim(),
);
if (!previewBootstrapLoginIdResult.success) {
  fail(
    "PREVIEW_BOOTSTRAP_LOGIN_ID is required and must satisfy the login ID contract",
  );
}
const previewBootstrapLoginId = previewBootstrapLoginIdResult.data;
const approvedLegacyBootstrapLoginIds = ["preview-admin", "previewadmin"];
const approvedCurrentBootstrapLoginIds = new Set([
  ...approvedLegacyBootstrapLoginIds,
  previewBootstrapLoginId,
]);

if (
  provisionPhase !== "EXPAND" &&
  provisionPhase !== "EXPAND_IDENTITY_LOCK" &&
  provisionPhase !== "CONTRACT"
) {
  fail(
    "PREVIEW_PROVISION_PHASE must be EXPAND, EXPAND_IDENTITY_LOCK, or CONTRACT",
  );
}
const contractPhase = provisionPhase === "CONTRACT";
const loginIdRotationPhase =
  provisionPhase === "EXPAND_IDENTITY_LOCK" || contractPhase;
let contractCompatibleAclPhase = contractPhase;
let identityLockPhase =
  provisionPhase === "EXPAND_IDENTITY_LOCK" || contractPhase;

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
    {
      database_owner_role_name: string;
      owns_database: boolean;
      role_identifier: string;
      role_name: string;
    }[]
  >`
    select current_user as role_name,
           format('%I', current_user) as role_identifier,
           pg_get_userbyid(database_record.datdba) as database_owner_role_name,
           current_user::regrole::oid = database_record.datdba as owns_database
    from pg_database database_record
    where database_record.datname = current_database()
  `;
  if (!migrationOwnerIdentity)
    fail("Preview migration owner identity is unavailable");
  if (!migrationOwnerIdentity.owns_database) {
    fail("Preview migration credential must own the Preview database");
  }
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
  let checklistExpandPrerequisitesPresent = false;
  if (existingMigrationMarker?.exists) {
    const [checklistPrerequisites] = await owner<{ exact: boolean }[]>`
      select count(*) = 2 as exact
        from public.schema_migrations
       where version in (
         '0036_hotel_facility_master_data',
         '0037_hotel_inspection_execution_targets'
       )
    `;
    checklistExpandPrerequisitesPresent = checklistPrerequisites?.exact === true;
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
      "0013_neon_definer_creator_membership",
      "0013_neon_definer_creator_membership.sql",
    ],
    [
      "0014_neon_definer_expand_compatibility",
      "0014_neon_definer_expand_compatibility.sql",
    ],
    [
      "0008_remove_legacy_company_id_fallback",
      "0008_remove_legacy_company_id_fallback.sql",
    ],
    [
      "0012_account_provider_exact_dispatch_contract",
      "0012_account_provider_exact_dispatch_contract.sql",
    ],
    [
      "0015_neon_definer_contract_hardening",
      "0015_neon_definer_contract_hardening.sql",
    ],
    ["0010_global_login_id_contract", "0010_global_login_id_contract.sql"],
    [
      "0016_hotel_relationship_management",
      "0016_hotel_relationship_management.sql",
    ],
    [
      "0017_hotel_relationship_integrity_hardening",
      "0017_hotel_relationship_integrity_hardening.sql",
    ],
    [
      "0018_hotel_support_assignment_overlap",
      "0018_hotel_support_assignment_overlap.sql",
    ],
    ["0019_hotel_room_management", "0019_hotel_room_management.sql"],
    [
      "0022_hotel_room_contract_hardening",
      "0022_hotel_room_contract_hardening.sql",
    ],
    [
      "0023_login_id_registry_history_contract",
      "0023_login_id_registry_history_contract.sql",
    ],
    [
      "0024_preview_bootstrap_session_revocations",
      "0024_preview_bootstrap_session_revocations.sql",
    ],
    [
      "0025_hotel_room_reference_lifecycle",
      "0025_hotel_room_reference_lifecycle.sql",
    ],
    [
      "0026_hotel_inspection_process_and_files",
      "0026_hotel_inspection_process_and_files.sql",
    ],
    [
      "0027_hotel_file_finalizer_recovery",
      "0027_hotel_file_finalizer_recovery.sql",
    ],
    [
      "0028_hotel_process_default_read_contract",
      "0028_hotel_process_default_read_contract.sql",
    ],
    [
      "0029_hotel_process_reviewer_candidates",
      "0029_hotel_process_reviewer_candidates.sql",
    ],
    [
      "0030_hotel_inspection_routine_contract",
      "0030_hotel_inspection_routine_contract.sql",
    ],
    [
      "0031_hotel_inspection_execution_contract",
      "0031_hotel_inspection_execution_contract.sql",
    ],
    [
      "0032_hotel_inspection_evidence_processing",
      "0032_hotel_inspection_evidence_processing.sql",
    ],
    ["0033_hotel_file_upload_scope", "0033_hotel_file_upload_scope.sql"],
    [
      "0034_hotel_inspection_evidence_submission",
      "0034_hotel_inspection_evidence_submission.sql",
    ],
    [
      "0035_hotel_inspection_review_and_file_view",
      "0035_hotel_inspection_review_and_file_view.sql",
    ],
    ["0036_hotel_facility_master_data", "0036_hotel_facility_master_data.sql"],
    [
      "0037_hotel_inspection_execution_targets",
      "0037_hotel_inspection_execution_targets.sql",
    ],
    [
      "0038_hotel_inspection_checklist_targets",
      "0038_hotel_inspection_checklist_targets.sql",
    ],
    [
      "0039_hotel_inspection_checklist_v2_hardening",
      "0039_hotel_inspection_checklist_v2_hardening.sql",
    ],
  ] as const;
  const contractOnlyMigrations = new Set([
    "0008_remove_legacy_company_id_fallback",
    "0010_global_login_id_contract",
    "0012_account_provider_exact_dispatch_contract",
    "0015_neon_definer_contract_hardening",
    "0022_hotel_room_contract_hardening",
    "0023_login_id_registry_history_contract",
    "0024_preview_bootstrap_session_revocations",
    "0025_hotel_room_reference_lifecycle",
    "0026_hotel_inspection_process_and_files",
    "0027_hotel_file_finalizer_recovery",
    "0028_hotel_process_default_read_contract",
    "0029_hotel_process_reviewer_candidates",
    "0030_hotel_inspection_routine_contract",
    "0031_hotel_inspection_execution_contract",
    "0032_hotel_inspection_evidence_processing",
    "0033_hotel_file_upload_scope",
    "0034_hotel_inspection_evidence_submission",
    "0035_hotel_inspection_review_and_file_view",
    "0036_hotel_facility_master_data",
    "0037_hotel_inspection_execution_targets",
  ]);
  const prerequisiteGatedExpandMigrations = new Set([
    "0038_hotel_inspection_checklist_targets",
    "0039_hotel_inspection_checklist_v2_hardening",
  ]);
  const freshBootstrapRequested =
    process.env.PREVIEW_PROVISION_FRESH_BOOTSTRAP_FULL === "1";
  const freshBootstrap =
    freshBootstrapRequested && existingMigrationMarker?.exists !== true;
  const migrations = contractPhase
    ? allMigrations.filter(
        ([version]) => version !== "0010_global_login_id_contract",
      )
    : freshBootstrap
      ? allMigrations
      : allMigrations.filter(
        ([version]) =>
          !contractOnlyMigrations.has(version) &&
          (!prerequisiteGatedExpandMigrations.has(version) ||
            checklistExpandPrerequisitesPresent),
      );

  const readContractBaseState = async () => {
    const [objects] = await owner<
      {
        auth_identities_exists: boolean;
        login_id_registry_exists: boolean;
        schema_migrations_exists: boolean;
        users_exists: boolean;
      }[]
    >`
      select
        to_regclass('public.users') is not null as users_exists,
        to_regclass('public.auth_identities') is not null as auth_identities_exists,
        to_regclass('public.login_id_registry') is not null as login_id_registry_exists,
        to_regclass('public.schema_migrations') is not null as schema_migrations_exists
    `;
    if (!objects) fail("Preview contract base state is unavailable");
    let contractMarkerCount = 0;
    if (objects.schema_migrations_exists) {
      const [markers] = await owner<{ count: number }[]>`
        select count(*)::integer as count
        from public.schema_migrations
        where version in (
          '0008_remove_legacy_company_id_fallback',
          '0010_global_login_id_contract',
          '0012_account_provider_exact_dispatch_contract',
          '0015_neon_definer_contract_hardening'
        )
      `;
      contractMarkerCount =
        markers?.count ?? fail("Preview contract marker state is unavailable");
    }
    return {
      ...objects,
      contract_marker_count: contractMarkerCount,
    };
  };
  const contractBaseState = await readContractBaseState();
  const bootstrapSchemaReady =
    contractBaseState.users_exists &&
    contractBaseState.auth_identities_exists &&
    contractBaseState.login_id_registry_exists;
  const bootstrapSchemaPresent =
    contractBaseState.users_exists ||
    contractBaseState.auth_identities_exists ||
    contractBaseState.login_id_registry_exists;
  if (bootstrapSchemaPresent && !bootstrapSchemaReady) {
    fail("Preview bootstrap schema is incomplete");
  }
  if (provisionPhase === "EXPAND") {
    if (
      contractBaseState.contract_marker_count !== 0 &&
      contractBaseState.contract_marker_count !== 4
    ) {
      fail("Preview contract markers are partial");
    }
    contractCompatibleAclPhase = contractBaseState.contract_marker_count === 4;
    identityLockPhase = contractCompatibleAclPhase;
  }
  if (
    loginIdRotationPhase &&
    bootstrapSchemaReady &&
    contractBaseState.contract_marker_count === 4
  ) {
    const [historyContract] = await owner<{ applied: boolean }[]>`
      select exists (
        select 1 from public.schema_migrations
        where version = '0023_login_id_registry_history_contract'
      ) as applied
    `;
    if (!historyContract?.applied) {
      await owner.unsafe(
        await readFile(
          resolve(
            migrationDirectory,
            "0023_login_id_registry_history_contract.sql",
          ),
          "utf8",
        ),
      );
    }
  }
  if (contractPhase && bootstrapSchemaReady) {
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
        for update of app_user
      `;
      if (rows.length > 0) {
        if (
          rows.length !== 1 ||
          rows[0]?.company_id !== previewCompanyId ||
          rows[0].provider_subject !== zitadelSubject ||
          rows[0].status !== "ACTIVE" ||
          (rows[0].login_name !== null &&
            !approvedCurrentBootstrapLoginIds.has(rows[0].login_name))
        ) {
          fail("Existing Preview bootstrap identity cannot be aligned safely");
        }
        if (
          rows[0].login_name !== previewBootstrapLoginId &&
          (loginIdRotationPhase ||
            rows[0].login_name === null ||
            !loginIdSchema.safeParse(rows[0].login_name).success)
        ) {
          const legacyLoginState =
            rows[0].login_name === null
              ? "LEGACY_UNSET"
              : "LEGACY_NON_CANONICAL";
          const collision = await sql<{ exists: boolean }[]>`
            select exists (
              select 1 from public.users
              where lower(btrim(login_name)) = ${previewBootstrapLoginId}
                and id <> ${previewUserId}::uuid
            ) as exists
          `;
          if (collision[0]?.exists) {
            fail("Preview bootstrap canonical login ID is unavailable");
          }
          await sql`
            insert into public.login_id_registry (login_id, company_id, target_user_id)
            values (${previewBootstrapLoginId}, ${previewCompanyId}::uuid, ${previewUserId}::uuid)
            on conflict (login_id) do nothing
          `;
          const [registryClaim] = await sql<
            { company_id: string; target_user_id: string }[]
          >`
            select company_id::text, target_user_id::text
            from public.login_id_registry
            where login_id = ${previewBootstrapLoginId}
          `;
          if (
            registryClaim?.company_id !== previewCompanyId ||
            registryClaim.target_user_id !== previewUserId
          ) {
            fail(
              "Preview bootstrap canonical login ID registry claim is unavailable",
            );
          }
          await sql`
            update public.users
            set login_name = ${previewBootstrapLoginId},
                version = version + 1,
                updated_at = pg_catalog.statement_timestamp()
            where id = ${previewUserId}::uuid
              and company_id = ${previewCompanyId}::uuid
              and (login_name in ('preview-admin', 'previewadmin') or login_name is null)
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
              pg_catalog.jsonb_build_object('state', ${legacyLoginState}::text),
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
  if (freshBootstrap) {
    contractCompatibleAclPhase = true;
    identityLockPhase = true;
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
      for update of app_user
    `;
    if (rows.length === 0) return;
    if (
      rows.length !== 1 ||
      rows[0]?.company_id !== previewCompanyId ||
      rows[0].provider_subject !== zitadelSubject ||
      rows[0].status !== "ACTIVE" ||
      (rows[0].login_name !== null &&
        !approvedCurrentBootstrapLoginIds.has(rows[0].login_name))
    ) {
      fail("Existing Preview bootstrap identity cannot be aligned safely");
    }
    if (
      !loginIdRotationPhase &&
      rows[0].login_name !== null &&
      loginIdSchema.safeParse(rows[0].login_name).success
    ) {
      return;
    }
    if (rows[0].login_name === previewBootstrapLoginId) return;
    const legacyLoginState =
      rows[0].login_name === null ? "LEGACY_UNSET" : "LEGACY_NON_CANONICAL";
    const collision = await sql<{ exists: boolean }[]>`
      select exists (
        select 1 from public.users
        where lower(btrim(login_name)) = ${previewBootstrapLoginId}
          and id <> ${previewUserId}::uuid
      ) as exists
    `;
    if (collision[0]?.exists)
      fail("Preview bootstrap canonical login ID is unavailable");
    await sql`
      insert into public.login_id_registry (login_id, company_id, target_user_id)
      values (${previewBootstrapLoginId}, ${previewCompanyId}::uuid, ${previewUserId}::uuid)
      on conflict (login_id) do nothing
    `;
    const [registryClaim] = await sql<
      { company_id: string; target_user_id: string }[]
    >`
      select company_id::text, target_user_id::text
      from public.login_id_registry
      where login_id = ${previewBootstrapLoginId}
    `;
    if (
      registryClaim?.company_id !== previewCompanyId ||
      registryClaim.target_user_id !== previewUserId
    ) {
      fail(
        "Preview bootstrap canonical login ID registry claim is unavailable",
      );
    }
    await sql`
      update public.users
      set login_name = ${previewBootstrapLoginId},
          version = version + 1,
          updated_at = pg_catalog.statement_timestamp()
      where id = ${previewUserId}::uuid
        and company_id = ${previewCompanyId}::uuid
        and (login_name in ('preview-admin', 'previewadmin') or login_name is null)
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
        pg_catalog.jsonb_build_object('state', ${legacyLoginState}::text),
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
    const [existingSeedUser] = await sql<{ login_name: string | null }[]>`
      select login_name
      from users
      where id = ${previewUserId}::uuid
        and company_id = ${previewCompanyId}::uuid
      for update
    `;
    if (
      existingSeedUser?.login_name !== null &&
      existingSeedUser?.login_name !== undefined &&
      !approvedCurrentBootstrapLoginIds.has(existingSeedUser.login_name)
    ) {
      fail("Existing Preview user does not match the approved seed");
    }
    const activeSeedLoginId =
      existingSeedUser?.login_name &&
      !loginIdRotationPhase &&
      loginIdSchema.safeParse(existingSeedUser.login_name).success
        ? existingSeedUser.login_name
        : previewBootstrapLoginId;
    await sql`
      insert into login_id_registry (login_id, company_id, target_user_id)
      values (${activeSeedLoginId}, ${previewCompanyId}::uuid, ${previewUserId}::uuid)
      on conflict (login_id) do nothing
    `;
    const [seedRegistryClaim] = await sql<
      { company_id: string; target_user_id: string }[]
    >`
      select company_id::text, target_user_id::text
      from login_id_registry
      where login_id = ${activeSeedLoginId}
    `;
    if (
      seedRegistryClaim?.company_id !== previewCompanyId ||
      seedRegistryClaim.target_user_id !== previewUserId
    ) {
      fail(
        "Preview bootstrap canonical login ID registry claim is unavailable",
      );
    }
    await sql`
      insert into users (id, company_id, user_type, display_name, status, login_name, email)
      values (
        ${previewUserId}::uuid,
        ${previewCompanyId}::uuid,
        'INTERNAL_STAFF',
        'Preview 관리자',
        'ACTIVE',
        ${activeSeedLoginId},
        'preview-admin@werehere.invalid'
      )
      on conflict (id) do update
      set login_name = case
            when users.login_name is null or users.login_name = 'preview-admin'
              then excluded.login_name
            else users.login_name
          end,
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
      user.login_name !== activeSeedLoginId ||
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
    await sql`
      insert into permission_grants (
        id, company_id, branch_id, subject_type, subject_id,
        permission_code, effect, valid_from, valid_until, granted_by, reason
      ) values
        (${previewHotelRoomReadGrantId}::uuid, ${previewCompanyId}::uuid, null, 'USER', ${previewUserId}::uuid, 'HOTEL_ROOM_READ', 'ALLOW', '2026-01-01T00:00:00Z'::timestamptz, null, ${previewUserId}::uuid, 'Preview 초기 관리자 객실조회 권한'),
        (${previewHotelRoomManageGrantId}::uuid, ${previewCompanyId}::uuid, null, 'USER', ${previewUserId}::uuid, 'HOTEL_ROOM_MANAGE', 'ALLOW', '2026-01-01T00:00:00Z'::timestamptz, null, ${previewUserId}::uuid, 'Preview 초기 관리자 객실관리 권한'),
        (${previewHotelRoomTypeManageGrantId}::uuid, ${previewCompanyId}::uuid, null, 'USER', ${previewUserId}::uuid, 'HOTEL_ROOM_TYPE_MANAGE', 'ALLOW', '2026-01-01T00:00:00Z'::timestamptz, null, ${previewUserId}::uuid, 'Preview 초기 관리자 객실유형관리 권한')
      on conflict (id) do nothing
    `;
    const roomGrants = await sql<
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
         ${previewHotelRoomReadGrantId}::uuid,
         ${previewHotelRoomManageGrantId}::uuid,
         ${previewHotelRoomTypeManageGrantId}::uuid
       )
    `;
    const expectedRoomGrants = new Map([
      [
        "HOTEL_ROOM_READ",
        {
          id: previewHotelRoomReadGrantId,
          reason: "Preview 초기 관리자 객실조회 권한",
        },
      ],
      [
        "HOTEL_ROOM_MANAGE",
        {
          id: previewHotelRoomManageGrantId,
          reason: "Preview 초기 관리자 객실관리 권한",
        },
      ],
      [
        "HOTEL_ROOM_TYPE_MANAGE",
        {
          id: previewHotelRoomTypeManageGrantId,
          reason: "Preview 초기 관리자 객실유형관리 권한",
        },
      ],
    ]);
    if (
      roomGrants.length !== expectedRoomGrants.size ||
      roomGrants.some((grant) => {
        const expected = expectedRoomGrants.get(grant.permission_code);
        return (
          !expected ||
          grant.id !== expected.id ||
          grant.company_id !== previewCompanyId ||
          grant.branch_id !== null ||
          grant.subject_type !== "USER" ||
          grant.subject_id !== previewUserId ||
          grant.effect !== "ALLOW" ||
          grant.valid_from !== "2026-01-01T00:00:00Z" ||
          grant.valid_until !== null ||
          grant.granted_by !== previewUserId ||
          grant.reason !== expected.reason ||
          grant.version !== 1
        );
      })
    ) {
      fail(
        "Existing Preview room permission grants do not match the approved seed",
      );
    }
    await sql`
        insert into permission_grants (
          id, company_id, branch_id, subject_type, subject_id,
          permission_code, effect, valid_from, valid_until, granted_by, reason
        ) values
        (${previewHotelAssignmentGrantId}::uuid, ${previewCompanyId}::uuid, null, 'USER', ${previewUserId}::uuid, 'HOTEL_ASSIGNMENT_MANAGE', 'ALLOW', '2026-01-01T00:00:00Z'::timestamptz, null, ${previewUserId}::uuid, 'Preview 초기 관리자 호텔배정 권한'),
        (${previewHotelOwnerGrantId}::uuid, ${previewCompanyId}::uuid, null, 'USER', ${previewUserId}::uuid, 'HOTEL_OWNER_MANAGE', 'ALLOW', '2026-01-01T00:00:00Z'::timestamptz, null, ${previewUserId}::uuid, 'Preview 초기 관리자 호텔소유주 권한'),
        (${previewHotelStatusGrantId}::uuid, ${previewCompanyId}::uuid, null, 'USER', ${previewUserId}::uuid, 'HOTEL_STATUS_MANAGE', 'ALLOW', '2026-01-01T00:00:00Z'::timestamptz, null, ${previewUserId}::uuid, 'Preview 초기 관리자 호텔상태 권한')
        on conflict (id) do nothing
      `;
    const relationshipGrants = await sql<
      {
        branch_id: string | null;
        company_id: string;
        effect: string;
        granted_by: string;
        id: string;
        permission_code: string;
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
               valid_until::text, granted_by::text, version
        from permission_grants
        where id in (${previewHotelAssignmentGrantId}::uuid, ${previewHotelOwnerGrantId}::uuid, ${previewHotelStatusGrantId}::uuid)
        order by permission_code
      `;
    const exactRelationshipGrants = new Map([
      ["HOTEL_ASSIGNMENT_MANAGE", previewHotelAssignmentGrantId],
      ["HOTEL_OWNER_MANAGE", previewHotelOwnerGrantId],
      ["HOTEL_STATUS_MANAGE", previewHotelStatusGrantId],
    ]);
    if (
      relationshipGrants.length !== 3 ||
      relationshipGrants.some(
        (grant) =>
          exactRelationshipGrants.get(grant.permission_code) !== grant.id ||
          grant.company_id !== previewCompanyId ||
          grant.branch_id !== null ||
          grant.subject_type !== "USER" ||
          grant.subject_id !== previewUserId ||
          grant.effect !== "ALLOW" ||
          grant.valid_from !== "2026-01-01T00:00:00Z" ||
          grant.valid_until !== null ||
          grant.granted_by !== previewUserId ||
          grant.version !== 1,
      )
    )
      fail(
        "Existing Preview hotel relationship grants do not match the approved seed",
      );
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

  if (provisionPhase === "EXPAND") {
    const latestContractBaseState = await readContractBaseState();
    const expectedContractMarkerCount = freshBootstrap
      ? 4
      : contractBaseState.contract_marker_count;
    if (
      !latestContractBaseState.users_exists ||
      !latestContractBaseState.auth_identities_exists ||
      !latestContractBaseState.login_id_registry_exists ||
      latestContractBaseState.contract_marker_count !== expectedContractMarkerCount
    ) {
      fail("Preview contract base changed before ACL reconciliation");
    }
  }

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
    if (contractCompatibleAclPhase) {
      await sql`
        delete from runtime_database_capabilities
        where role_name not in (${apiRuntimeRole}, ${reconcilerRole})
      `;
    }
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
    !contractCompatibleAclPhase &&
    legacyRuntimeState?.exists &&
    legacyRuntimeState.compatible_capability
      ? ", werehere_preview_runtime"
      : "";
  const legacyPolicyGrant =
    contractCompatibleAclPhase && legacyRuntimeState?.exists
      ? ", werehere_preview_runtime"
      : "";
  const apiRuntimeTableGrantees = `${apiRuntimeRole}${legacyCompatibilityGrant}`;
  const [roomLifecycleState] = await owner<{ contracted: boolean }[]>`
    select exists (
      select 1 from public.schema_migrations
      where version = '0025_hotel_room_reference_lifecycle'
    ) as contracted
  `;
  if (!roomLifecycleState) {
    fail("Preview room lifecycle marker state is unavailable");
  }
  const [inspectionProcessState] = await owner<{ contracted: boolean }[]>`
    select exists (
      select 1 from public.schema_migrations
      where version = '0026_hotel_inspection_process_and_files'
    ) and exists (
      select 1 from public.schema_migrations
      where version = '0027_hotel_file_finalizer_recovery'
    ) and exists (
      select 1 from public.schema_migrations
      where version = '0028_hotel_process_default_read_contract'
    ) and exists (
      select 1 from public.schema_migrations
      where version = '0029_hotel_process_reviewer_candidates'
    ) and exists (
      select 1 from public.schema_migrations
      where version = '0030_hotel_inspection_routine_contract'
    ) and exists (
      select 1 from public.schema_migrations
      where version = '0031_hotel_inspection_execution_contract'
    ) and exists (
      select 1 from public.schema_migrations
      where version = '0032_hotel_inspection_evidence_processing'
    ) and exists (
      select 1 from public.schema_migrations
      where version = '0033_hotel_file_upload_scope'
    ) and exists (
      select 1 from public.schema_migrations
      where version = '0034_hotel_inspection_evidence_submission'
    ) and exists (
      select 1 from public.schema_migrations
      where version = '0035_hotel_inspection_review_and_file_view'
    ) as contracted
  `;
  if (!inspectionProcessState) {
    fail("Preview inspection process marker state is unavailable");
  }
  if (inspectionProcessState.contracted) {
    await owner`
      insert into public.hotel_file_finalizer_capabilities (role_name)
      values (${reconcilerRole})
      on conflict (role_name) do nothing
    `;
  }

  const [facilityMasterDataState] = await owner<{ contracted: boolean }[]>`
    select exists (
      select 1 from public.schema_migrations
      where version = '0036_hotel_facility_master_data'
    ) as contracted
  `;
  if (!facilityMasterDataState) {
    fail("Preview facility master-data marker state is unavailable");
  }
  const [inspectionTargetChecklistState] = await owner<
    { expanded: boolean; hardened: boolean }[]
  >`
    select exists (
      select 1 from public.schema_migrations
      where version = '0038_hotel_inspection_checklist_targets'
    ) as expanded,
    exists (
      select 1 from public.schema_migrations
      where version = '0039_hotel_inspection_checklist_v2_hardening'
    ) as hardened
  `;
  if (!inspectionTargetChecklistState) {
    fail("Preview inspection checklist target marker state is unavailable");
  }

  if (contractCompatibleAclPhase && legacyRuntimeState?.exists) {
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

    do $migration_owned_column_acl_reset$
    declare
      acl_record record;
    begin
      for acl_record in
        select distinct table_namespace.nspname as schema_name,
               table_record.relname as table_name,
               column_record.attname as column_name,
               acl.grantee,
               grantee_role.rolname as grantee_name
        from pg_class table_record
        join pg_namespace table_namespace
          on table_namespace.oid = table_record.relnamespace
        join pg_attribute column_record
          on column_record.attrelid = table_record.oid
         and column_record.attnum > 0
         and not column_record.attisdropped
        cross join lateral aclexplode(column_record.attacl) acl
        left join pg_roles grantee_role on grantee_role.oid = acl.grantee
        where table_namespace.nspname = 'public'
          and table_record.relkind in ('r', 'p')
          and table_record.relowner = current_user::regrole::oid
          and acl.grantee <> table_record.relowner
      loop
        if acl_record.grantee = 0::oid then
          execute format(
            'revoke all privileges (%I) on table %I.%I from public cascade',
            acl_record.column_name,
            acl_record.schema_name,
            acl_record.table_name
          );
        else
          execute format(
            'revoke all privileges (%I) on table %I.%I from %I cascade',
            acl_record.column_name,
            acl_record.schema_name,
            acl_record.table_name,
            acl_record.grantee_name
          );
        end if;
      end loop;
    end
    $migration_owned_column_acl_reset$;

    revoke create on schema public from public;
    ${contractCompatibleAclPhase ? "revoke usage on schema public from public;" : "grant usage on schema public to public;"}

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
      housekeeping_hotel_links, hotel_owner_assignments,
      hotel_room_types, hotel_rooms, hotel_room_status_history
      ${
        facilityMasterDataState.contracted
          ? `, hotel_common_areas, hotel_facility_types, hotel_facilities,
      hotel_common_area_history, hotel_facility_type_history, hotel_facility_history`
          : ""
      }
      ${
        inspectionProcessState.contracted
          ? `, process_definitions, process_definition_revisions,
      process_stage_snapshots, process_transition_snapshots, hotel_process_defaults,
      process_executions, process_execution_history,
      inspection_checklist_revisions, inspection_checklist_items,
      inspection_checklist_item_exclusions, inspection_routines,
      inspection_routine_revisions, inspection_routine_rounds,
      hotel_inspections, inspection_item_snapshots, inspection_item_results,
      inspection_item_result_history, hotel_file_uploads, hotel_file_versions,
      hotel_file_links, hotel_file_finalizer_capabilities`
          : ""
      }
    to ${apiRuntimeTableGrantees};
    grant insert, update, delete on auth_login_transactions to ${apiRuntimeTableGrantees};
    grant insert, update, delete on auth_credential_rate_limits to ${apiRuntimeTableGrantees};

    grant insert on audit_events, branches, hotel_profiles, auth_identities,
      hotel_staff_assignments, housekeeping_hotel_links, hotel_owner_assignments,
      hotel_room_types${roomLifecycleState.contracted ? "" : ", hotel_rooms"}
      ${roomLifecycleState.contracted ? "" : ", hotel_room_status_history"}
    to ${apiRuntimeTableGrantees};
    grant update (name, display_order, is_active, version, updated_by, updated_at)
      on hotel_room_types to ${apiRuntimeTableGrantees};
    ${
      roomLifecycleState.contracted
        ? `
    revoke insert on hotel_rooms from ${apiRuntimeRole}${legacyPolicyGrant};
    revoke update (
      room_number, floor_label, floor_sort_key, room_type_id, status,
      internal_note, owner_visible_note, version, updated_by, updated_at
    ) on hotel_rooms from ${apiRuntimeRole}${legacyPolicyGrant};`
        : `grant update (
      room_number, floor_label, floor_sort_key, room_type_id,
      status, internal_note, owner_visible_note, planned_resume_date,
      version, updated_by, updated_at
    ) on hotel_rooms to ${apiRuntimeTableGrantees};`
    }
    grant insert, update on users, account_provisioning_attempts,
      initial_password_change_attempts to ${apiRuntimeTableGrantees};
    grant insert on login_id_registry to ${apiRuntimeTableGrantees};
    revoke update (updated_at) on auth_identities
      from ${apiRuntimeTableGrantees}, ${reconcilerRole};
    revoke update (updated_at) on branches, hotel_profiles
      from ${reconcilerRole};
    revoke update (version) on hotel_profiles
      from ${apiRuntimeTableGrantees}, ${reconcilerRole};
    revoke update (end_date, terminated_at, termination_reason, terminated_by, version, updated_at)
      on hotel_staff_assignments, housekeeping_hotel_links, hotel_owner_assignments
      from ${apiRuntimeTableGrantees}, ${reconcilerRole};
    grant update (updated_at) on branches, hotel_profiles
      to ${apiRuntimeTableGrantees};
    grant update (version) on hotel_profiles to ${apiRuntimeTableGrantees};
    grant update (end_date, terminated_at, termination_reason, terminated_by, version, updated_at)
      on hotel_staff_assignments, housekeeping_hotel_links, hotel_owner_assignments
      to ${apiRuntimeTableGrantees};
    ${
      identityLockPhase
        ? `grant update (updated_at) on auth_identities to ${apiRuntimeTableGrantees};`
        : ""
    }
    grant insert, update, delete on idempotency_records to ${apiRuntimeTableGrantees};
    grant insert, update on outbox_jobs to ${apiRuntimeTableGrantees};
    ${
      roomLifecycleState.contracted
        ? `
    do $exact_room_command_acl$
    declare
      acl_record record;
    begin
      for acl_record in
        select procedure_record.oid::regprocedure::text as signature,
               acl.grantee,
               grantee_role.rolname as grantee_name
          from pg_catalog.pg_proc procedure_record
          join pg_catalog.pg_namespace procedure_namespace
            on procedure_namespace.oid = procedure_record.pronamespace
          cross join lateral pg_catalog.aclexplode(coalesce(
            procedure_record.proacl,
            pg_catalog.acldefault('f'::"char", procedure_record.proowner)
          )) acl
          left join pg_catalog.pg_roles grantee_role
            on grantee_role.oid = acl.grantee
         where procedure_namespace.nspname = 'public'
           and procedure_record.proname in (
             'hotel_room_lifecycle_command_v1',
             'hotel_room_write_command_v1'
           )
           and acl.privilege_type = 'EXECUTE'
           and acl.grantee <> procedure_record.proowner
      loop
        if acl_record.grantee = 0::oid then
          execute pg_catalog.format(
            'revoke all privileges on function %s from public cascade',
            acl_record.signature
          );
        else
          execute pg_catalog.format(
            'revoke all privileges on function %s from %I cascade',
            acl_record.signature,
            acl_record.grantee_name
          );
        end if;
      end loop;
    end
    $exact_room_command_acl$;
    revoke all privileges on function public.hotel_room_lifecycle_command_v1(
      uuid, uuid, uuid, integer, text, text, uuid, uuid, uuid,
      text, text, text, text, text, uuid
    ) from public, ${reconcilerRole}${legacyPolicyGrant};
    grant execute on function public.hotel_room_lifecycle_command_v1(
      uuid, uuid, uuid, integer, text, text, uuid, uuid, uuid,
      text, text, text, text, text, uuid
    ) to ${apiRuntimeRole};
    revoke all privileges on function public.hotel_room_write_command_v1(
      uuid, uuid, uuid, text, integer, jsonb, uuid, uuid,
      text, text, text, text, text, uuid
    ) from public, ${reconcilerRole}${legacyPolicyGrant};
    grant execute on function public.hotel_room_write_command_v1(
      uuid, uuid, uuid, text, integer, jsonb, uuid, uuid,
      text, text, text, text, text, uuid
    ) to ${apiRuntimeRole};
    `
        : ""
    }
    ${
      facilityMasterDataState.contracted
        ? `
    do $exact_facility_command_acl$
    declare
      acl_record record;
    begin
      for acl_record in
        select procedure_record.oid::regprocedure::text as signature,
               acl.grantee,
               grantee_role.rolname as grantee_name
          from pg_catalog.pg_proc procedure_record
          join pg_catalog.pg_namespace procedure_namespace
            on procedure_namespace.oid = procedure_record.pronamespace
          cross join lateral pg_catalog.aclexplode(coalesce(
            procedure_record.proacl,
            pg_catalog.acldefault('f'::"char", procedure_record.proowner)
          )) acl
          left join pg_catalog.pg_roles grantee_role
            on grantee_role.oid = acl.grantee
         where procedure_namespace.nspname = 'public'
           and procedure_record.proname = 'hotel_facility_reference_command_v1'
           and acl.privilege_type = 'EXECUTE'
           and acl.grantee <> procedure_record.proowner
      loop
        if acl_record.grantee = 0::oid then
          execute pg_catalog.format(
            'revoke all privileges on function %s from public cascade',
            acl_record.signature
          );
        else
          execute pg_catalog.format(
            'revoke all privileges on function %s from %I cascade',
            acl_record.signature,
            acl_record.grantee_name
          );
        end if;
      end loop;
    end
    $exact_facility_command_acl$;
    revoke all privileges on function public.hotel_facility_reference_command_v1(
      uuid, uuid, text, text, uuid, integer, jsonb, text,
      uuid, uuid, uuid, text, text, text, text, text, uuid
    ) from public, ${reconcilerRole}${legacyPolicyGrant};
    grant execute on function public.hotel_facility_reference_command_v1(
      uuid, uuid, text, text, uuid, integer, jsonb, text,
      uuid, uuid, uuid, text, text, text, text, text, uuid
    ) to ${apiRuntimeRole};
    `
        : ""
    }
    ${
      inspectionProcessState.contracted
        ? `
    do $exact_inspection_command_acl$
    declare
      acl_record record;
    begin
      for acl_record in
        select procedure_record.oid::regprocedure::text as signature,
               acl.grantee,
               grantee_role.rolname as grantee_name
          from pg_catalog.pg_proc procedure_record
          join pg_catalog.pg_namespace procedure_namespace
            on procedure_namespace.oid = procedure_record.pronamespace
          cross join lateral pg_catalog.aclexplode(coalesce(
            procedure_record.proacl,
            pg_catalog.acldefault('f'::"char", procedure_record.proowner)
          )) acl
          left join pg_catalog.pg_roles grantee_role
            on grantee_role.oid = acl.grantee
         where procedure_namespace.nspname = 'public'
           and procedure_record.proname in (
             'hotel_process_command_v1', 'hotel_process_default_read_v1',
             'hotel_process_reviewer_candidates_v1',
             'hotel_inspection_routines_read_v1',
             'hotel_inspection_routine_command_v1',
             'hotel_inspection_executions_read_v1',
             'hotel_inspection_command_v2',
             'hotel_inspection_checklist_v2_command',
             'hotel_inspection_checklist_v3_command',
             'inspection_checklist_v2_snapshot_v1',
             'inspection_checklist_v1_sync_v2',
             'hotel_file_command_v1', 'hotel_file_upload_scope_v1',
             'hotel_file_scan_command_v1',
             'hotel_file_scan_candidates_v1',
             'hotel_inspection_claim_materialization_v1',
             'hotel_inspection_complete_materialization_v1',
             'hotel_active_actor_v1',
             'hotel_process_reviewer_is_eligible_v1',
             'hotel_process_actor_is_assigned_v1',
             'hotel_inspection_review_snapshot_v1',
             'hotel_inspection_reviews_read_v1',
             'hotel_inspection_transition_v1',
             'hotel_file_view_command_v1',
             'hotel_file_access_recover_expired_v1'
           )
           and acl.privilege_type = 'EXECUTE'
           and acl.grantee <> procedure_record.proowner
      loop
        if acl_record.grantee = 0::oid then
          execute pg_catalog.format(
            'revoke all privileges on function %s from public cascade',
            acl_record.signature
          );
        else
          execute pg_catalog.format(
            'revoke all privileges on function %s from %I cascade',
            acl_record.signature,
            acl_record.grantee_name
          );
        end if;
      end loop;
    end
    $exact_inspection_command_acl$;

    grant execute on function public.hotel_process_command_v1(
      uuid, uuid, uuid, text, integer, jsonb, text, uuid, text,
      text, text, text, uuid, uuid
    ) to ${apiRuntimeRole};
    grant execute on function public.hotel_process_default_read_v1(
      uuid, uuid, text
    ) to ${apiRuntimeRole};
    grant execute on function public.hotel_process_reviewer_candidates_v1(
      uuid, uuid, text
    ) to ${apiRuntimeRole};
    grant execute on function public.hotel_inspection_routines_read_v1(
      uuid, uuid, uuid, text
    ) to ${apiRuntimeRole};
    grant execute on function public.hotel_inspection_routine_command_v1(
      uuid, uuid, uuid, integer, jsonb, text, text, text, text, text,
      uuid, uuid, uuid
    ) to ${apiRuntimeRole};
    grant execute on function public.hotel_inspection_executions_read_v1(
      uuid, uuid, uuid, jsonb, text
    ) to ${apiRuntimeRole};
    revoke execute on function public.hotel_inspection_command_v1(
      uuid, uuid, uuid, text, integer, jsonb, text, uuid, text,
      text, text, text, uuid, uuid
    ) from ${apiRuntimeRole};
    grant execute on function public.hotel_inspection_command_v2(
      uuid, uuid, uuid, text, integer, jsonb, text, uuid, text,
      text, text, text, uuid, uuid
    ) to ${apiRuntimeRole};
    ${
      inspectionTargetChecklistState.expanded
        ? `grant execute on function public.hotel_inspection_checklist_v2_command(
      uuid, uuid, uuid, text, integer, jsonb, text, uuid, text,
      text, text, text, uuid, uuid
    ) to ${apiRuntimeRole};`
        : ""
    }
    ${
      inspectionTargetChecklistState.hardened
        ? `grant execute on function public.hotel_inspection_checklist_v3_command(
      uuid, uuid, uuid, text, integer, jsonb, text, uuid, text,
      text, text, text, uuid, uuid
    ) to ${apiRuntimeRole};`
        : ""
    }
    grant execute on function public.hotel_file_command_v1(
      uuid, uuid, uuid, text, integer, jsonb, text, uuid, text,
      text, text, text, uuid, uuid
    ) to ${apiRuntimeRole};
    grant execute on function public.hotel_file_upload_scope_v1(
      uuid, uuid, text
    ) to ${apiRuntimeRole};
    grant execute on function public.hotel_inspection_reviews_read_v1(
      uuid, uuid, uuid, jsonb, text
    ) to ${apiRuntimeRole};
    grant execute on function public.hotel_inspection_transition_v1(
      uuid, uuid, uuid, integer, jsonb, text, uuid, text, text, text, uuid, uuid
    ) to ${apiRuntimeRole};
    grant execute on function public.hotel_file_view_command_v1(
      uuid, uuid, uuid, uuid, text, text, uuid, text, uuid, uuid, uuid
    ) to ${apiRuntimeRole};
    grant execute on function public.hotel_file_scan_command_v1(
      uuid, text, text, bigint, jsonb, uuid
    ) to ${reconcilerRole};
    grant execute on function public.hotel_file_scan_candidates_v1(
      integer
    ) to ${reconcilerRole};
    grant execute on function public.hotel_file_access_recover_expired_v1(
      integer
    ) to ${reconcilerRole};
    grant execute on function public.hotel_inspection_claim_materialization_v1(
      uuid, bytea, integer
    ) to ${reconcilerRole};
    grant execute on function public.hotel_inspection_complete_materialization_v1(
      uuid, bigint, bytea, uuid
    ) to ${reconcilerRole};
    `
        : ""
    }

    grant select on
      schema_migrations, companies, permissions, users, auth_identities, branches, hotel_profiles,
      runtime_database_capabilities, outbox_jobs, account_provisioning_attempts,
      hotel_staff_assignments, housekeeping_hotel_links, hotel_owner_assignments
      ${inspectionProcessState.contracted ? ", hotel_file_finalizer_capabilities" : ""}
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
              'auth_revoke_user_sessions_v1',
              'auth_revoke_hotel_owner_sessions_v1'
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
        public.auth_revoke_user_sessions_v1(uuid, uuid, text),
        public.auth_revoke_hotel_owner_sessions_v1(uuid, uuid)
        from public;
      revoke grant option for execute on function public.auth_create_session_v2(
        uuid, bytea, text, integer, integer, timestamptz, uuid
      ), public.auth_resolve_login_identity_v1(text),
        public.auth_resolve_principal_v2(bytea, integer),
        public.auth_revoke_session_v2(bytea, text, uuid),
        public.auth_revoke_user_sessions_v1(uuid, uuid, text),
        public.auth_revoke_hotel_owner_sessions_v1(uuid, uuid)
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
      grant execute on function public.auth_revoke_hotel_owner_sessions_v1(uuid, uuid)
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
        from ${reconcilerRole};
      revoke execute on function public.auth_revoke_hotel_owner_sessions_v1(uuid, uuid)
        from ${reconcilerRole}${legacyPolicyGrant};
      ${
        contractCompatibleAclPhase && legacyRuntimeState?.exists
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
      revoke execute on function public.auth_revoke_hotel_owner_sessions_v1(uuid, uuid)
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
        contractCompatibleAclPhase && legacyRuntimeState?.exists
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

  if (contractCompatibleAclPhase && legacyRuntimeState?.exists) {
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

  const residualDefinerMembershipCommands = await owner<{ command: string }[]>`
    select format(
             'revoke %I from %I granted by %I',
             definer_role.rolname,
             member_role.rolname,
             grantor_role.rolname
           ) as command
    from pg_auth_members membership
    join pg_roles definer_role on definer_role.oid = membership.roleid
    join pg_roles member_role on member_role.oid = membership.member
    join pg_roles grantor_role on grantor_role.oid = membership.grantor
    where definer_role.rolname in (
      'werehere_auth_session_definer',
      'werehere_tenant_authority_definer'
    )
      and grantor_role.rolname = current_user
    order by definer_role.rolname, member_role.rolname
  `;
  for (const membership of residualDefinerMembershipCommands) {
    await owner.unsafe(membership.command);
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
      grantor_superuser: boolean;
      inherit_option: boolean;
      member_role: string;
      set_option: boolean;
    }[]
  >`
    select definer_role.rolname as definer_role,
           member_role.rolname as member_role,
           grantor_role.rolname as grantor_role,
           grantor_role.rolsuper as grantor_superuser,
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
  `;
  const neonCreatorDefinerRoles = new Set([
    "werehere_auth_session_definer",
    "werehere_tenant_authority_definer",
  ]);
  const hasExactNeonCreatorMemberships =
    definerMembershipSafety.length === neonCreatorDefinerRoles.size &&
    new Set(
      definerMembershipSafety.map((membership) => membership.definer_role),
    ).size === neonCreatorDefinerRoles.size &&
    definerMembershipSafety.every(
      (membership) =>
        neonCreatorDefinerRoles.has(membership.definer_role) &&
        membership.member_role ===
          migrationOwnerIdentity.database_owner_role_name &&
        membership.grantor_role === "cloud_admin" &&
        membership.grantor_superuser &&
        membership.admin_option &&
        !membership.inherit_option &&
        !membership.set_option,
    );
  if (definerMembershipSafety.length !== 0 && !hasExactNeonCreatorMemberships) {
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

  const requiredRolloutPhase = contractCompatibleAclPhase
    ? "CONTRACT"
    : provisionPhase;
  const requiredRoomRolloutPhase: "CONTRACT" | "EXPAND" =
    roomLifecycleState.contracted
      ? "CONTRACT"
      : provisionPhase === "CONTRACT"
        ? "CONTRACT"
        : "EXPAND";
  const [loginIdHistoryRolloutState] = await owner<{ contracted: boolean }[]>`
    select exists (
      select 1 from public.schema_migrations
      where version = '0023_login_id_registry_history_contract'
    ) as contracted
  `;
  if (!loginIdHistoryRolloutState) {
    fail("Preview login ID history rollout marker state is unavailable");
  }
  const requiredLoginIdHistoryRolloutPhase: "CONTRACT" | "EXPAND" =
    loginIdHistoryRolloutState.contracted ? "CONTRACT" : "EXPAND";
  const [inspectionProcessRolloutState] = await owner<
    { contracted: boolean }[]
  >`
    select exists (
      select 1 from public.schema_migrations
      where version = '0026_hotel_inspection_process_and_files'
    ) and exists (
      select 1 from public.schema_migrations
      where version = '0027_hotel_file_finalizer_recovery'
    ) and exists (
      select 1 from public.schema_migrations
      where version = '0028_hotel_process_default_read_contract'
    ) and exists (
      select 1 from public.schema_migrations
      where version = '0029_hotel_process_reviewer_candidates'
    ) and exists (
      select 1 from public.schema_migrations
      where version = '0030_hotel_inspection_routine_contract'
    ) and exists (
      select 1 from public.schema_migrations
      where version = '0031_hotel_inspection_execution_contract'
    ) and exists (
      select 1 from public.schema_migrations
      where version = '0032_hotel_inspection_evidence_processing'
    ) and exists (
      select 1 from public.schema_migrations
      where version = '0033_hotel_file_upload_scope'
    ) and exists (
      select 1 from public.schema_migrations
      where version = '0034_hotel_inspection_evidence_submission'
    ) and exists (
      select 1 from public.schema_migrations
      where version = '0035_hotel_inspection_review_and_file_view'
    ) as contracted
  `;
  if (!inspectionProcessRolloutState) {
    fail("Preview inspection process rollout marker state is unavailable");
  }
  const requiredInspectionProcessPhase: "CONTRACT" | "EXPAND" =
    inspectionProcessRolloutState.contracted ? "CONTRACT" : "EXPAND";
  const apiReadiness = await probeDatabaseReadiness(apiRuntimeUrl.toString(), {
    capability: "API_RUNTIME",
    requiredFacilityMasterDataPhase: facilityMasterDataState.contracted
      ? "CONTRACT"
      : "EXPAND",
    requiredInspectionProcessPhase,
    requiredLoginIdHistoryPhase: requiredLoginIdHistoryRolloutPhase,
    requiredRoomSchemaPhase: requiredRoomRolloutPhase,
    requiredSchemaPhase: requiredRolloutPhase,
    onSchemaNotReady: (checkpoint) =>
      console.error(`READINESS_CHECKPOINT_${checkpoint}_API_RUNTIME`),
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
      requiredFacilityMasterDataPhase: facilityMasterDataState.contracted
        ? "CONTRACT"
        : "EXPAND",
      requiredInspectionProcessPhase,
      requiredLoginIdHistoryPhase: requiredLoginIdHistoryRolloutPhase,
      requiredRoomSchemaPhase: requiredRoomRolloutPhase,
      requiredSchemaPhase: requiredRolloutPhase,
      onSchemaNotReady: (checkpoint) =>
        console.error(`READINESS_CHECKPOINT_${checkpoint}_RECONCILER`),
    },
  );
  if (reconcilerReadiness.status !== "READY") {
    fail(`Preview reconciler readiness failed: ${reconcilerReadiness.status}`);
  }

  console.log("PREVIEW_DATABASE_PROVISIONED");
  console.log(`PREVIEW_DATABASE_PHASE_${provisionPhase}`);
  if (provisionPhase === "EXPAND" && contractCompatibleAclPhase) {
    console.log("PREVIEW_DATABASE_CONTRACT_COMPATIBLE_EXPAND");
  }
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
