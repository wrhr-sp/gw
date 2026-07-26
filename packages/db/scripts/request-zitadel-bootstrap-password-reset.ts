import { createHash } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { requestZitadelBootstrapPasswordReset } from "../src/zitadel-bootstrap-password-reset";

const FAILURE = "ZITADEL bootstrap password reset request failed";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(FAILURE);
  return value;
}

function requestFingerprint(input: {
  approvalRef: string;
  emailFingerprint: string;
  issuerFingerprint: string;
  organizationFingerprint: string;
  subjectFingerprint: string;
  webBaseUrl: string;
}): string {
  return createHash("sha256")
    .update(JSON.stringify(input), "utf8")
    .digest("hex");
}

async function reserveOperation(
  sql: Sql,
  input: {
    approvalRef: string;
    requestFingerprint: string;
    subjectFingerprint: string;
  },
): Promise<"PROCEED" | "REPLAYED"> {
  return sql.begin(async (transaction) => {
    const inserted = await transaction<{ operation_key: string }[]>`
      insert into public.preview_bootstrap_operations (
        operation_key, operation_type, subject_fingerprint,
        request_fingerprint, status
      ) values (
        ${input.approvalRef}, 'PASSWORD_RESET_EMAIL',
        ${input.subjectFingerprint}, ${input.requestFingerprint}, 'REQUESTING'
      )
      on conflict (operation_key) do nothing
      returning operation_key
    `;
    if (inserted.length === 1) return "PROCEED";
    const existing = await transaction<
      {
        operation_type: string;
        request_fingerprint: string;
        status: string;
        subject_fingerprint: string;
      }[]
    >`
      select operation_type, subject_fingerprint, request_fingerprint, status
      from public.preview_bootstrap_operations
      where operation_key = ${input.approvalRef}
      for update
    `;
    const operation = existing[0];
    if (
      existing.length !== 1 ||
      operation?.operation_type !== "PASSWORD_RESET_EMAIL" ||
      operation.subject_fingerprint !== input.subjectFingerprint ||
      operation.request_fingerprint !== input.requestFingerprint
    ) {
      throw new Error(FAILURE);
    }
    if (operation.status === "REQUESTED") return "REPLAYED";
    throw new Error(FAILURE);
  });
}

async function transitionOperation(
  sql: Sql,
  input: {
    approvalRef: string;
    requestFingerprint: string;
    status: "INDETERMINATE" | "REQUESTED";
    subjectFingerprint: string;
  },
): Promise<void> {
  const updated = await sql<{ operation_key: string }[]>`
    update public.preview_bootstrap_operations
    set status = ${input.status},
        updated_at = pg_catalog.statement_timestamp()
    where operation_key = ${input.approvalRef}
      and operation_type = 'PASSWORD_RESET_EMAIL'
      and subject_fingerprint = ${input.subjectFingerprint}
      and request_fingerprint = ${input.requestFingerprint}
      and status = 'REQUESTING'
    returning operation_key
  `;
  if (updated.length !== 1) throw new Error(FAILURE);
}

async function main(): Promise<void> {
  const approvalRef = required("PREVIEW_BOOTSTRAP_APPROVAL_REF");
  if (!/^[A-Za-z0-9._:/-]{3,200}$/u.test(approvalRef)) {
    throw new Error(FAILURE);
  }
  const subjectFingerprint = required(
    "ZITADEL_PREVIEW_BOOTSTRAP_SUBJECT_SHA256",
  ).toLowerCase();
  const issuerFingerprint = required(
    "ZITADEL_PREVIEW_ISSUER_SHA256",
  ).toLowerCase();
  const organizationFingerprint = required(
    "ZITADEL_PREVIEW_ORGANIZATION_ID_SHA256",
  ).toLowerCase();
  const emailFingerprint = required(
    "ZITADEL_PREVIEW_EMAIL_SHA256",
  ).toLowerCase();
  for (const fingerprint of [
    subjectFingerprint,
    issuerFingerprint,
    organizationFingerprint,
    emailFingerprint,
  ]) {
    if (!/^[0-9a-f]{64}$/u.test(fingerprint)) throw new Error(FAILURE);
  }
  const webBaseUrl = required("WEB_PREVIEW_URL");
  const operationRequestFingerprint = requestFingerprint({
    approvalRef,
    emailFingerprint,
    issuerFingerprint,
    organizationFingerprint,
    subjectFingerprint,
    webBaseUrl,
  });
  const sql = postgres(required("DATABASE_URL_PREVIEW"), {
    max: 1,
    prepare: false,
    ssl: "require",
  });
  try {
    const result = await requestZitadelBootstrapPasswordReset({
      approvedEmailFingerprint: emailFingerprint,
      approvedIssuerFingerprint: issuerFingerprint,
      approvedOrganizationFingerprint: organizationFingerprint,
      approvedSubjectFingerprint: subjectFingerprint,
      beforeResetRequest: () =>
        reserveOperation(sql, {
          approvalRef,
          requestFingerprint: operationRequestFingerprint,
          subjectFingerprint,
        }),
      issuer: required("ZITADEL_ISSUER"),
      onResetIndeterminate: () =>
        transitionOperation(sql, {
          approvalRef,
          requestFingerprint: operationRequestFingerprint,
          status: "INDETERMINATE",
          subjectFingerprint,
        }),
      onResetRequested: () =>
        transitionOperation(sql, {
          approvalRef,
          requestFingerprint: operationRequestFingerprint,
          status: "REQUESTED",
          subjectFingerprint,
        }),
      organizationId: required("ZITADEL_ORGANIZATION_ID"),
      subject: required("ZITADEL_PREVIEW_BOOTSTRAP_SUBJECT"),
      token: required("ZITADEL_USER_PROVISIONER_TOKEN"),
      webBaseUrl,
    });
    console.log(
      result.status === "REPLAYED"
        ? "ZITADEL_BOOTSTRAP_PASSWORD_RESET_ALREADY_REQUESTED"
        : "ZITADEL_BOOTSTRAP_PASSWORD_RESET_REQUESTED",
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch(() => {
  console.error(FAILURE);
  process.exitCode = 1;
});
