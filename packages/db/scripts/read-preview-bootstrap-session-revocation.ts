import { createHash, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { revokeZitadelBootstrapSessions } from "../src/zitadel-bootstrap-session-revocation";
import { verifyZitadelBootstrapIdentity } from "../src/zitadel-bootstrap-verifier";

const FAILURE = "Preview bootstrap session revocation read-back failed";
const PREVIEW_COMPANY_ID = "70000000-0000-4000-8000-000000000001";
const PREVIEW_USER_ID = "71000000-0000-4000-8000-000000000001";
const PREVIEW_IDENTITY_ID = "72000000-0000-4000-8000-000000000001";
const stages = new Set([
  "INPUTS",
  "DATABASE_CONNECT",
  "DATABASE_IDENTITY",
  "DATABASE_STATE",
  "PROVIDER_IDENTITY",
  "PROVIDER_STATE",
  "OUTPUT",
]);
let stage = "INPUTS";

function fail(): never {
  throw new Error(FAILURE);
}

function enterStage(next: string): void {
  if (!stages.has(next)) fail();
  stage = next;
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

function assertDatabaseUrl(value: string): void {
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
}

async function main(): Promise<void> {
  enterStage("INPUTS");
  const approvalRef = required("PREVIEW_BOOTSTRAP_APPROVAL_REF");
  const databaseUrl = required("DATABASE_URL_PREVIEW");
  const approvedDatabaseIdentity = required("PREVIEW_DATABASE_IDENTITY_SHA256");
  const issuer = required("ZITADEL_ISSUER");
  const organizationId = required("ZITADEL_ORGANIZATION_ID");
  const subject = required("ZITADEL_PREVIEW_SUBJECT");
  const subjectFingerprint = required("ZITADEL_PREVIEW_SUBJECT_SHA256");
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
  assertDatabaseUrl(databaseUrl);

  enterStage("DATABASE_CONNECT");
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    enterStage("DATABASE_IDENTITY");
    const identities = await sql<
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
    const identity = identities[0];
    if (
      identities.length !== 1 ||
      !identity?.branch_id ||
      !identity.project_id ||
      !identity.database_name
    ) {
      fail();
    }
    const databaseIdentity = JSON.stringify({
      branchId: identity.branch_id,
      databaseName: identity.database_name,
      projectId: identity.project_id,
    });
    fingerprint(databaseIdentity, approvedDatabaseIdentity);
    const databaseIdentityFingerprint = sha256(databaseIdentity);
    const operationKey = sha256(
      `preview-bootstrap-session-revocation:${approvalRef}`,
    );
    const operationFingerprint = sha256(
      JSON.stringify({
        approvalRef,
        companyId: PREVIEW_COMPANY_ID,
        databaseIdentityFingerprint,
        identityId: PREVIEW_IDENTITY_ID,
        issuerFingerprint: sha256(issuer),
        operation: "PREVIEW_BOOTSTRAP_SESSION_REVOCATION_V1",
        organizationFingerprint: sha256(organizationId),
        subjectFingerprint: subjectFingerprint.toLowerCase(),
        userId: PREVIEW_USER_ID,
      }),
    );

    enterStage("DATABASE_STATE");
    const operations = await sql<
      {
        application_revoked_count: number | null;
        company_id: string;
        completed_at: Date | null;
        created_at: Date;
        identity_id: string;
        operation_fingerprint: string;
        operation_key: string;
        provider_revoked_count: number | null;
        source_reset_operation_key: string;
        status: string;
        subject_fingerprint: string;
        user_id: string;
      }[]
    >`
      select operation_key, operation_fingerprint, source_reset_operation_key,
             subject_fingerprint, company_id::text, user_id::text, identity_id::text,
             status, provider_revoked_count, application_revoked_count,
             created_at, completed_at
      from preview_bootstrap_session_revocations
      order by created_at, operation_key
    `;
    if (operations.length > 1) fail();
    const operation = operations[0];
    const normalizedSubjectFingerprint = subjectFingerprint.toLowerCase();
    if (
      operation &&
      (operation.operation_key !== operationKey ||
        operation.operation_fingerprint !== operationFingerprint ||
        operation.source_reset_operation_key !== approvalRef ||
        operation.subject_fingerprint !== normalizedSubjectFingerprint ||
        operation.company_id !== PREVIEW_COMPANY_ID ||
        operation.user_id !== PREVIEW_USER_ID ||
        operation.identity_id !== PREVIEW_IDENTITY_ID)
    ) {
      fail();
    }
    const status = operation?.status ?? "NONE";
    if (
      !new Set(["NONE", "REQUESTING", "INDETERMINATE", "COMPLETED"]).has(status)
    )
      fail();
    if (
      status === "COMPLETED" &&
      (operation?.provider_revoked_count === null ||
        operation.application_revoked_count === null ||
        operation.completed_at === null)
    ) {
      fail();
    }
    if (
      status !== "COMPLETED" &&
      operation &&
      (operation.provider_revoked_count !== null ||
        operation.application_revoked_count !== null ||
        operation.completed_at !== null)
    ) {
      fail();
    }
    const tuple = await sql<{ ready: boolean }[]>`
      select exists (
        select 1
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
      ) as ready
    `;
    if (tuple.length !== 1 || tuple[0]?.ready !== true) fail();
    const application = await sql<{ zero: boolean }[]>`
      select not exists (
        select 1 from auth_sessions
        where company_id = ${PREVIEW_COMPANY_ID}::uuid
          and user_id = ${PREVIEW_USER_ID}::uuid
          and identity_id = ${PREVIEW_IDENTITY_ID}::uuid
          and revoked_at is null
      ) as zero
    `;
    if (application.length !== 1) fail();

    let auditPresent = false;
    if (operation && status === "COMPLETED") {
      const audit = await sql<{ count: number }[]>`
        select count(*)::int as count
        from audit_events
        where company_id = ${PREVIEW_COMPANY_ID}::uuid
          and event_code = 'ACCOUNT_SESSION_REVOKED'
          and actor_type = 'SYSTEM'
          and actor_user_id is null
          and session_id is null
          and branch_id is null
          and resource_type = 'USER'
          and resource_id = ${PREVIEW_USER_ID}::uuid
          and before_summary is null
          and after_summary = jsonb_build_object(
            'applicationRevokedCount', ${operation.application_revoked_count},
            'providerRevokedCount', ${operation.provider_revoked_count}
          )
          and reason = 'PASSWORD_ROTATED'
          and result = 'SUCCEEDED'
          and trace_id is not null
          and occurred_at >= ${operation.created_at}
          and occurred_at <= ${operation.completed_at}
      `;
      if (audit.length !== 1 || audit[0]?.count !== 1) fail();
      auditPresent = true;
    } else if (operation) {
      const conflictingAudit = await sql<{ count: number }[]>`
        select count(*)::int as count
        from audit_events
        where company_id = ${PREVIEW_COMPANY_ID}::uuid
          and event_code = 'ACCOUNT_SESSION_REVOKED'
          and actor_type = 'SYSTEM'
          and actor_user_id is null
          and resource_type = 'USER'
          and resource_id = ${PREVIEW_USER_ID}::uuid
          and reason = 'PASSWORD_ROTATED'
          and result = 'SUCCEEDED'
          and occurred_at >= ${operation.created_at}
      `;
      if (conflictingAudit.length !== 1 || conflictingAudit[0]?.count !== 0)
        fail();
    }

    enterStage("PROVIDER_IDENTITY");
    await verifyZitadelBootstrapIdentity({
      approvedSubjectFingerprint: subjectFingerprint,
      issuer,
      organizationId,
      subject,
      token,
    });
    enterStage("PROVIDER_STATE");
    const provider = await revokeZitadelBootstrapSessions({
      issuer,
      mode: "READ_ONLY",
      organizationId,
      subject,
      token,
    });

    const providerZero = provider.remainingCount === 0;
    const applicationZero = application[0]?.zero === true;
    if (
      status === "COMPLETED" &&
      (!providerZero || !applicationZero || !auditPresent)
    ) {
      fail();
    }

    enterStage("OUTPUT");
    process.stdout.write(`PREVIEW_REVOCATION_STATE_${status}\n`);
    process.stdout.write(
      `PREVIEW_REVOCATION_PROVIDER_ZERO_${providerZero ? "YES" : "NO"}\n`,
    );
    process.stdout.write(
      `PREVIEW_REVOCATION_APPLICATION_ZERO_${applicationZero ? "YES" : "NO"}\n`,
    );
    process.stdout.write(
      `PREVIEW_REVOCATION_AUDIT_PRESENT_${auditPresent ? "YES" : "NO"}\n`,
    );
  } catch {
    process.stderr.write(`Preview revocation read-back failed at ${stage}\n`);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
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
