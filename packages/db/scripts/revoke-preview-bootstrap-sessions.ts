import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { revokeZitadelBootstrapSessions } from "../src/zitadel-bootstrap-session-revocation";
import { verifyZitadelBootstrapIdentity } from "../src/zitadel-bootstrap-verifier";

const FAILURE = "Preview bootstrap session revocation failed";
const PREVIEW_COMPANY_ID = "70000000-0000-4000-8000-000000000001";
const PREVIEW_USER_ID = "71000000-0000-4000-8000-000000000001";
const PREVIEW_IDENTITY_ID = "72000000-0000-4000-8000-000000000001";

function fail(): never {
  throw new Error(FAILURE);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value !== value.trim()) fail();
  return value;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function fingerprint(value: string, expectedValue: string): void {
  const expectedHex = expectedValue.toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(expectedHex)) fail();
  const actual = Buffer.from(sha256(value), "hex");
  const expected = Buffer.from(expectedHex, "hex");
  if (expected.length !== actual.length || !timingSafeEqual(actual, expected))
    fail();
}

function databaseUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    fail();
  }
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !parsed.hostname.toLowerCase().endsWith(".neon.tech") ||
    !["require", "verify-ca", "verify-full"].includes(
      parsed.searchParams.get("sslmode")?.toLowerCase() ?? "",
    )
  ) {
    fail();
  }
  return parsed;
}

async function neonIdentity(sql: postgres.Sql): Promise<{
  branchId: string;
  databaseName: string;
  projectId: string;
}> {
  const rows = await sql<
    {
      branch_id: string | null;
      database_name: string;
      project_id: string | null;
    }[]
  >`
    select nullif(current_setting('neon.branch_id', true), '') as branch_id,
           current_database() as database_name,
           nullif(current_setting('neon.project_id', true), '') as project_id
  `;
  const identity = rows[0];
  if (!identity?.branch_id || !identity.project_id) fail();
  return {
    branchId: identity.branch_id,
    databaseName: identity.database_name,
    projectId: identity.project_id,
  };
}

export async function assertPreviewBootstrapSessionRevocationLedgerReady(
  sql: postgres.TransactionSql,
): Promise<void> {
  await sql`lock table public.preview_bootstrap_session_revocations in access exclusive mode`;
  const columns = await sql<
    {
      column_default: string | null;
      column_name: string;
      data_type: string;
      is_nullable: "NO" | "YES";
    }[]
  >`
    select column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'preview_bootstrap_session_revocations'
    order by ordinal_position
  `;
  const columnShape = columns.map((column) => ({
    defaultValue: column.column_default,
    name: column.column_name,
    nullable: column.is_nullable,
    type: column.data_type,
  }));
  const expectedColumnShape = [
    {
      defaultValue: null,
      name: "operation_key",
      nullable: "NO",
      type: "text",
    },
    {
      defaultValue: null,
      name: "operation_fingerprint",
      nullable: "NO",
      type: "text",
    },
    {
      defaultValue: null,
      name: "source_reset_operation_key",
      nullable: "NO",
      type: "text",
    },
    {
      defaultValue: null,
      name: "subject_fingerprint",
      nullable: "NO",
      type: "text",
    },
    { defaultValue: null, name: "company_id", nullable: "NO", type: "uuid" },
    { defaultValue: null, name: "user_id", nullable: "NO", type: "uuid" },
    { defaultValue: null, name: "identity_id", nullable: "NO", type: "uuid" },
    { defaultValue: null, name: "status", nullable: "NO", type: "text" },
    {
      defaultValue: null,
      name: "provider_revoked_count",
      nullable: "YES",
      type: "integer",
    },
    {
      defaultValue: null,
      name: "application_revoked_count",
      nullable: "YES",
      type: "integer",
    },
    {
      defaultValue: "statement_timestamp()",
      name: "created_at",
      nullable: "NO",
      type: "timestamp with time zone",
    },
    {
      defaultValue: "statement_timestamp()",
      name: "updated_at",
      nullable: "NO",
      type: "timestamp with time zone",
    },
    {
      defaultValue: null,
      name: "completed_at",
      nullable: "YES",
      type: "timestamp with time zone",
    },
  ];
  if (JSON.stringify(columnShape) !== JSON.stringify(expectedColumnShape))
    fail();

  const constraints = await sql<
    {
      definition: string;
      deferrable: boolean;
      deferred: boolean;
      delete_action: string;
      match_type: string;
      name: string;
      type: string;
      update_action: string;
      validated: boolean;
    }[]
  >`
    select constraint_record.conname as name,
           constraint_record.contype::text as type,
           pg_get_constraintdef(constraint_record.oid, true) as definition,
           constraint_record.convalidated as validated,
           constraint_record.condeferrable as deferrable,
           constraint_record.condeferred as deferred,
           constraint_record.confupdtype::text as update_action,
           constraint_record.confdeltype::text as delete_action,
           constraint_record.confmatchtype::text as match_type
    from pg_constraint constraint_record
    where constraint_record.conrelid =
      'public.preview_bootstrap_session_revocations'::regclass
      and constraint_record.contype <> 'n'
    order by constraint_record.conname
  `;
  const expectedConstraints: Record<
    string,
    { definition: string; type: "c" | "f" | "p" | "u" }
  > = {
    preview_bootstrap_session_revocations_application_count_check: {
      definition: "CHECK (application_revoked_count >= 0)",
      type: "c",
    },
    preview_bootstrap_session_revocations_completion_check: {
      definition:
        "CHECK ((status = 'COMPLETED'::text) = (completed_at IS NOT NULL AND provider_revoked_count IS NOT NULL AND application_revoked_count IS NOT NULL))",
      type: "c",
    },
    preview_bootstrap_session_revocations_identity_fkey: {
      definition:
        "FOREIGN KEY (company_id, identity_id, user_id) REFERENCES auth_identities(company_id, id, user_id)",
      type: "f",
    },
    preview_bootstrap_session_revocations_incomplete_check: {
      definition:
        "CHECK (status = 'COMPLETED'::text OR completed_at IS NULL AND provider_revoked_count IS NULL AND application_revoked_count IS NULL)",
      type: "c",
    },
    preview_bootstrap_revocations_operation_fingerprint_check: {
      definition: "CHECK (operation_fingerprint ~ '^[0-9a-f]{64}$'::text)",
      type: "c",
    },
    preview_bootstrap_session_revocations_operation_fingerprint_key: {
      definition: "UNIQUE (operation_fingerprint)",
      type: "u",
    },
    preview_bootstrap_revocations_operation_key_check: {
      definition: "CHECK (operation_key ~ '^[0-9a-f]{64}$'::text)",
      type: "c",
    },
    preview_bootstrap_session_revocations_pkey: {
      definition: "PRIMARY KEY (operation_key)",
      type: "p",
    },
    preview_bootstrap_session_revocations_provider_count_check: {
      definition: "CHECK (provider_revoked_count >= 0)",
      type: "c",
    },
    preview_bootstrap_session_revocations_source_reset_fkey: {
      definition:
        "FOREIGN KEY (source_reset_operation_key) REFERENCES preview_bootstrap_operations(operation_key)",
      type: "f",
    },
    preview_bootstrap_session_revocations_source_reset_key: {
      definition: "UNIQUE (source_reset_operation_key)",
      type: "u",
    },
    preview_bootstrap_session_revocations_status_check: {
      definition:
        "CHECK (status = ANY (ARRAY['REQUESTING'::text, 'COMPLETED'::text, 'INDETERMINATE'::text]))",
      type: "c",
    },
    preview_bootstrap_session_revocations_subject_fingerprint_check: {
      definition: "CHECK (subject_fingerprint ~ '^[0-9a-f]{64}$'::text)",
      type: "c",
    },
    preview_bootstrap_session_revocations_user_fkey: {
      definition:
        "FOREIGN KEY (company_id, user_id) REFERENCES users(company_id, id)",
      type: "f",
    },
  };
  if (constraints.length !== Object.keys(expectedConstraints).length) fail();
  for (const constraint of constraints) {
    const expected = expectedConstraints[constraint.name];
    if (
      !expected ||
      constraint.type !== expected.type ||
      constraint.definition !== expected.definition ||
      constraint.validated !== true ||
      constraint.deferrable !== false ||
      constraint.deferred !== false ||
      (constraint.type === "f" &&
        (constraint.update_action !== "a" ||
          constraint.delete_action !== "a" ||
          constraint.match_type !== "s"))
    ) {
      fail();
    }
  }

  const tableMetadata = await sql<
    {
      current_owner_oid: string;
      force_row_security: boolean;
      owner_oid: string;
      persistence: string;
      relkind: string;
      row_security: boolean;
      server_version_num: number;
    }[]
  >`
    select table_record.relowner::text as owner_oid,
           current_user::regrole::oid::text as current_owner_oid,
           table_record.relkind::text as relkind,
           table_record.relpersistence::text as persistence,
           table_record.relrowsecurity as row_security,
           table_record.relforcerowsecurity as force_row_security,
           current_setting('server_version_num')::int as server_version_num
    from pg_class table_record
    where table_record.oid =
      'public.preview_bootstrap_session_revocations'::regclass
  `;
  const table = tableMetadata[0];
  if (
    tableMetadata.length !== 1 ||
    !table ||
    table.owner_oid !== table.current_owner_oid ||
    table.relkind !== "r" ||
    table.persistence !== "p" ||
    table.row_security !== false ||
    table.force_row_security !== false
  ) {
    fail();
  }

  const acl = await sql<
    {
      grantee: string;
      grantor: string;
      is_grantable: boolean;
      privilege_type: string;
    }[]
  >`
    select acl.grantor::text as grantor,
           acl.grantee::text as grantee,
           acl.privilege_type,
           acl.is_grantable
    from pg_class table_record
    cross join lateral aclexplode(
      coalesce(table_record.relacl, acldefault('r', table_record.relowner))
    ) acl
    where table_record.oid =
      'public.preview_bootstrap_session_revocations'::regclass
    order by acl.privilege_type, acl.grantor, acl.grantee
  `;
  const expectedPrivileges = [
    "DELETE",
    "INSERT",
    ...(table.server_version_num >= 170_000 ? ["MAINTAIN"] : []),
    "REFERENCES",
    "SELECT",
    "TRIGGER",
    "TRUNCATE",
    "UPDATE",
  ];
  if (
    acl.length !== expectedPrivileges.length ||
    acl.some(
      (grant, index) =>
        grant.grantor !== table.current_owner_oid ||
        grant.grantee !== table.current_owner_oid ||
        grant.privilege_type !== expectedPrivileges[index] ||
        grant.is_grantable !== false,
    )
  ) {
    fail();
  }

  const columnAcl = await sql<
    {
      column_name: string;
      grantee: string;
      grantor: string;
      is_grantable: boolean;
      privilege_type: string;
    }[]
  >`
    select attribute.attname as column_name,
           acl.grantor::text as grantor,
           acl.grantee::text as grantee,
           acl.privilege_type,
           acl.is_grantable
    from pg_attribute attribute
    cross join lateral aclexplode(attribute.attacl) acl
    where attribute.attrelid =
      'public.preview_bootstrap_session_revocations'::regclass
      and attribute.attnum > 0
      and not attribute.attisdropped
    order by attribute.attname, acl.privilege_type, acl.grantor, acl.grantee
  `;
  if (columnAcl.length !== 0) fail();
}

async function lockPreviewBootstrapTuple(
  sql: postgres.TransactionSql,
  subject: string,
): Promise<void> {
  const identities = await sql<{ identity_id: string }[]>`
    select identity.id as identity_id
    from auth_identities identity
    join users app_user
      on app_user.company_id = identity.company_id
     and app_user.id = identity.user_id
    join companies company on company.id = identity.company_id
    where identity.company_id = ${PREVIEW_COMPANY_ID}::uuid
      and identity.user_id = ${PREVIEW_USER_ID}::uuid
      and identity.id = ${PREVIEW_IDENTITY_ID}::uuid
      and identity.provider = 'ZITADEL'
      and identity.provider_subject = ${subject}
      and app_user.status = 'ACTIVE'
      and company.status = 'ACTIVE'
    for update of identity, app_user, company
  `;
  if (identities.length !== 1) fail();
}

async function main(): Promise<void> {
  const approvalRef = required("PREVIEW_BOOTSTRAP_APPROVAL_REF");
  const previewDatabaseUrl = required("DATABASE_URL_PREVIEW");
  const approvedDatabaseIdentityFingerprint = required(
    "PREVIEW_DATABASE_IDENTITY_SHA256",
  ).toLowerCase();
  const issuer = required("ZITADEL_ISSUER");
  const organizationId = required("ZITADEL_ORGANIZATION_ID");
  const subject = required("ZITADEL_PREVIEW_SUBJECT");
  const subjectFingerprint = required(
    "ZITADEL_PREVIEW_SUBJECT_SHA256",
  ).toLowerCase();
  const token = required("ZITADEL_USER_PROVISIONER_TOKEN");
  if (
    !/^[A-Za-z0-9._:/-]{3,200}$/u.test(approvalRef) ||
    !/^[A-Za-z0-9_-]{1,200}$/u.test(organizationId) ||
    !/^[A-Za-z0-9_-]{1,200}$/u.test(subject)
  ) {
    fail();
  }
  const issuerUrl = new URL(issuer);
  if (
    issuerUrl.protocol !== "https:" ||
    issuerUrl.username ||
    issuerUrl.password ||
    issuerUrl.pathname !== "/" ||
    issuerUrl.search ||
    issuerUrl.hash ||
    issuerUrl.origin !== issuer
  ) {
    fail();
  }
  fingerprint(issuer, required("ZITADEL_PREVIEW_ISSUER_SHA256"));
  fingerprint(
    organizationId,
    required("ZITADEL_PREVIEW_ORGANIZATION_ID_SHA256"),
  );
  fingerprint(subject, subjectFingerprint);

  databaseUrl(previewDatabaseUrl);

  const operationKey = sha256(
    `preview-bootstrap-session-revocation:${approvalRef}`,
  );
  const preview = postgres(previewDatabaseUrl, { max: 1, prepare: false });
  let operationFingerprint = "";
  let claimed = false;
  try {
    const ownerRows = await preview<{ owns_database: boolean }[]>`
      select current_user::regrole::oid = database_record.datdba as owns_database
      from pg_database database_record
      where database_record.datname = current_database()
    `;
    if (ownerRows[0]?.owns_database !== true) fail();
    const previewIdentity = await neonIdentity(preview);
    const databaseIdentity = JSON.stringify({
      branchId: previewIdentity.branchId,
      databaseName: previewIdentity.databaseName,
      projectId: previewIdentity.projectId,
    });
    const databaseIdentityFingerprint = sha256(databaseIdentity);
    fingerprint(databaseIdentity, approvedDatabaseIdentityFingerprint);
    operationFingerprint = sha256(
      JSON.stringify({
        approvalRef,
        companyId: PREVIEW_COMPANY_ID,
        databaseIdentityFingerprint,
        identityId: PREVIEW_IDENTITY_ID,
        issuerFingerprint: sha256(issuer),
        operation: "PREVIEW_BOOTSTRAP_SESSION_REVOCATION_V1",
        organizationFingerprint: sha256(organizationId),
        subjectFingerprint,
        userId: PREVIEW_USER_ID,
      }),
    );

    await verifyZitadelBootstrapIdentity({
      approvedSubjectFingerprint: subjectFingerprint,
      issuer,
      organizationId,
      subject,
      token,
    });

    const claim = await preview.begin(async (transaction) => {
      const schema = await transaction<{ ready: boolean }[]>`
        select exists (
          select 1 from schema_migrations
          where version = '0024_preview_bootstrap_session_revocations'
        ) as ready
      `;
      if (schema[0]?.ready !== true) fail();
      await assertPreviewBootstrapSessionRevocationLedgerReady(transaction);

      const reset = await transaction<{ operation_key: string }[]>`
        select operation_key
        from preview_bootstrap_operations
        where operation_key = ${approvalRef}
          and operation_type = 'PASSWORD_RESET_EMAIL'
          and subject_fingerprint = ${subjectFingerprint}
          and status = 'REQUESTED'
        for update
      `;
      if (reset.length !== 1) fail();

      await lockPreviewBootstrapTuple(transaction, subject);

      const existing = await transaction<
        {
          company_id: string;
          identity_id: string;
          operation_fingerprint: string;
          status: string;
          subject_fingerprint: string;
          user_id: string;
        }[]
      >`
        select operation_fingerprint, subject_fingerprint, company_id, user_id,
               identity_id, status
        from preview_bootstrap_session_revocations
        where source_reset_operation_key = ${approvalRef}
        for update
      `;
      const previous = existing[0];
      if (
        previous?.status === "COMPLETED" &&
        existing.length === 1 &&
        previous.operation_fingerprint === operationFingerprint &&
        previous.subject_fingerprint === subjectFingerprint &&
        previous.company_id === PREVIEW_COMPANY_ID &&
        previous.user_id === PREVIEW_USER_ID &&
        previous.identity_id === PREVIEW_IDENTITY_ID
      ) {
        return "COMPLETED" as const;
      }
      if (existing.length !== 0) fail();

      await transaction`
        insert into preview_bootstrap_session_revocations (
          operation_key, operation_fingerprint, source_reset_operation_key,
          subject_fingerprint, company_id, user_id, identity_id, status
        ) values (
          ${operationKey}, ${operationFingerprint}, ${approvalRef},
          ${subjectFingerprint}, ${PREVIEW_COMPANY_ID}::uuid,
          ${PREVIEW_USER_ID}::uuid, ${PREVIEW_IDENTITY_ID}::uuid, 'REQUESTING'
        )
      `;
      return "REQUESTING" as const;
    });
    if (claim === "COMPLETED") {
      process.stdout.write("PREVIEW_BOOTSTRAP_SESSIONS_ALREADY_REVOKED\n");
      return;
    }
    claimed = true;

    await preview.begin(async (transaction) => {
      await assertPreviewBootstrapSessionRevocationLedgerReady(transaction);
      const operation = await transaction<{ status: string }[]>`
        select status
        from preview_bootstrap_session_revocations
        where operation_key = ${operationKey}
          and operation_fingerprint = ${operationFingerprint}
          and company_id = ${PREVIEW_COMPANY_ID}::uuid
          and user_id = ${PREVIEW_USER_ID}::uuid
          and identity_id = ${PREVIEW_IDENTITY_ID}::uuid
        for update
      `;
      if (operation.length !== 1 || operation[0]?.status !== "REQUESTING")
        fail();
      await lockPreviewBootstrapTuple(transaction, subject);
      const provider = await revokeZitadelBootstrapSessions({
        issuer,
        organizationId,
        subject,
        token,
      });
      const providerReadback = await revokeZitadelBootstrapSessions({
        issuer,
        mode: "READ_ONLY",
        organizationId,
        subject,
        token,
      });
      if (providerReadback.remainingCount !== 0) fail();
      const revoked = await transaction<{ id: string }[]>`
        update auth_sessions
        set revoked_at = statement_timestamp(),
            revoke_reason = 'INITIAL_PASSWORD_CHANGED'
        where company_id = ${PREVIEW_COMPANY_ID}::uuid
          and user_id = ${PREVIEW_USER_ID}::uuid
          and identity_id = ${PREVIEW_IDENTITY_ID}::uuid
          and revoked_at is null
        returning id
      `;
      const applicationRevokedCount = revoked.length;
      const remaining = await transaction<{ count: number }[]>`
        select count(*)::int as count
        from auth_sessions
        where company_id = ${PREVIEW_COMPANY_ID}::uuid
          and user_id = ${PREVIEW_USER_ID}::uuid
          and identity_id = ${PREVIEW_IDENTITY_ID}::uuid
          and revoked_at is null
      `;
      if (remaining[0]?.count !== 0) fail();
      await transaction`
        insert into audit_events (
          id, event_code, actor_user_id, actor_type, company_id,
          resource_type, resource_id, after_summary, reason, result, trace_id
        ) values (
          ${randomUUID()}, 'ACCOUNT_SESSION_REVOKED', null, 'SYSTEM',
          ${PREVIEW_COMPANY_ID}::uuid, 'USER', ${PREVIEW_USER_ID}::uuid,
          ${transaction.json({
            applicationRevokedCount,
            providerRevokedCount: provider.revokedCount,
          })},
          'PASSWORD_ROTATED', 'SUCCEEDED', ${randomUUID()}
        )
      `;
      const completed = await transaction<{ operation_key: string }[]>`
        update preview_bootstrap_session_revocations
        set status = 'COMPLETED',
            provider_revoked_count = ${provider.revokedCount},
            application_revoked_count = ${applicationRevokedCount},
            completed_at = statement_timestamp(),
            updated_at = statement_timestamp()
        where operation_key = ${operationKey}
          and operation_fingerprint = ${operationFingerprint}
          and status = 'REQUESTING'
          and not exists (
            select 1 from auth_sessions
            where company_id = ${PREVIEW_COMPANY_ID}::uuid
              and user_id = ${PREVIEW_USER_ID}::uuid
              and identity_id = ${PREVIEW_IDENTITY_ID}::uuid
              and revoked_at is null
          )
        returning operation_key
      `;
      if (completed.length !== 1) fail();
    });
    claimed = false;
    process.stdout.write("PREVIEW_BOOTSTRAP_SESSIONS_REVOKED\n");
  } catch {
    if (claimed) {
      try {
        await preview`
          update preview_bootstrap_session_revocations
          set status = 'INDETERMINATE', updated_at = statement_timestamp()
          where operation_key = ${operationKey}
            and operation_fingerprint = ${operationFingerprint}
            and status = 'REQUESTING'
        `;
      } catch {
        // Preserve the generic failure below. REQUESTING also blocks replay.
      }
    }
    fail();
  } finally {
    await preview.end({ timeout: 5 });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(() => {
    process.stderr.write(`${FAILURE}\n`);
    process.exitCode = 1;
  });
}
