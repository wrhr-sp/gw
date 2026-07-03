import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

function buildAuditId(prefix: string, resourceId: string) {
  const safeResourceId = resourceId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "resource";
  return `${prefix}_${safeResourceId}_${Date.now()}`;
}

function toJsonb(value: Record<string, unknown> | undefined) {
  return JSON.stringify(value ?? {});
}

type OperationalAuditEventInput = {
  companyId: string;
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  category: "user" | "permission" | "policy" | "document_space" | "document_file" | "electronic_contract" | "vehicle_operation_log" | "board" | "audit";
  reason: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  maskedFields?: string[];
  source?: "web-admin" | "api-admin" | "system";
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export type OperationalFileAccessEventInput = {
  companyId: string;
  actorUserId: string;
  fileId: string;
  versionId?: string | null;
  action: "document.file.metadata.create" | "document.file.upload_init" | "document.file.upload_complete" | "document.file.download_init" | "document.file.delete";
  outcome: "allowed" | "denied" | "failed";
  storageProvider: string;
  objectKey?: string | null;
  checksumSha256?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export type OperationalPrivacyAccessEventInput = {
  companyId: string;
  actorUserId: string;
  subjectUserId?: string | null;
  resourceType: string;
  resourceId: string;
  accessType: "read" | "create" | "update" | "delete" | "download" | "export" | "permission_change";
  purpose: string;
  legalBasis: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export type OperationalPermissionChangeEventInput = {
  companyId: string;
  actorUserId: string;
  targetRoleCode: string;
  targetFeatureKey: string;
  permissionCodes: string[];
  enabled: boolean;
  reason: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export async function recordOperationalAuditEvent(env: PostgresEnv | undefined, input: OperationalAuditEventInput) {
  const sql = createOperationalSql(env);
  if (!sql) return false;

  const createdAt = input.createdAt ?? new Date().toISOString();
  const metadata = {
    ...(input.metadata ?? {}),
    category: input.category,
    reason: input.reason,
    maskedFields: input.maskedFields ?? ["민감 원문", "식별자 일부"],
    source: input.source ?? "api-admin",
  };

  try {
    await sql`
      insert into audit_logs (id, company_id, actor_user_id, action, resource_type, resource_id, before_json, after_json, metadata_json, created_at)
      values (
        ${buildAuditId("audit", input.resourceId)},
        ${input.companyId},
        ${input.actorUserId},
        ${input.action},
        ${input.resourceType},
        ${input.resourceId},
        ${input.before ? toJsonb(input.before) : null}::jsonb,
        ${input.after ? toJsonb(input.after) : null}::jsonb,
        ${toJsonb(metadata)}::jsonb,
        ${createdAt}::timestamptz
      )
    `;
    return true;
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return false;
    throw error;
  }
}

export async function recordOperationalFileAccessEvent(env: PostgresEnv | undefined, input: OperationalFileAccessEventInput) {
  const sql = createOperationalSql(env);
  if (!sql) return false;

  const createdAt = input.createdAt ?? new Date().toISOString();
  try {
    await sql`
      insert into file_access_logs (id, company_id, actor_user_id, file_id, version_id, action, outcome, storage_provider, object_key, checksum_sha256, metadata_json, created_at)
      values (
        ${buildAuditId("file_access", input.fileId)},
        ${input.companyId},
        ${input.actorUserId},
        ${input.fileId},
        ${input.versionId ?? null},
        ${input.action},
        ${input.outcome},
        ${input.storageProvider},
        ${input.objectKey ?? null},
        ${input.checksumSha256 ?? null},
        ${toJsonb(input.metadata)}::jsonb,
        ${createdAt}::timestamptz
      )
    `;

    return recordOperationalAuditEvent(env, {
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      action: input.action,
      resourceType: "document_file",
      resourceId: input.fileId,
      category: "document_file",
      reason: "문서 파일 접근·변경 감사 이벤트 표준 기록",
      after: {
        outcome: input.outcome,
        versionId: input.versionId ?? null,
        storageProvider: input.storageProvider,
        checksumSha256: input.checksumSha256 ? "recorded" : null,
      },
      maskedFields: ["파일 본문", "다운로드 토큰", "임시 URL"],
      metadata: input.metadata,
      createdAt,
    });
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return false;
    throw error;
  }
}

export async function recordOperationalPrivacyAccessEvent(env: PostgresEnv | undefined, input: OperationalPrivacyAccessEventInput) {
  const sql = createOperationalSql(env);
  if (!sql) return false;

  const createdAt = input.createdAt ?? new Date().toISOString();
  try {
    await sql`
      insert into privacy_access_logs (id, company_id, actor_user_id, subject_user_id, resource_type, resource_id, access_type, purpose, legal_basis, metadata_json, created_at)
      values (
        ${buildAuditId("privacy_access", input.resourceId)},
        ${input.companyId},
        ${input.actorUserId},
        ${input.subjectUserId ?? null},
        ${input.resourceType},
        ${input.resourceId},
        ${input.accessType},
        ${input.purpose},
        ${input.legalBasis},
        ${toJsonb(input.metadata)}::jsonb,
        ${createdAt}::timestamptz
      )
    `;

    return recordOperationalAuditEvent(env, {
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      action: `privacy.${input.accessType}`,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      category: "user",
      reason: input.purpose,
      after: {
        accessType: input.accessType,
        legalBasis: input.legalBasis,
        subjectUserId: input.subjectUserId ?? null,
      },
      maskedFields: ["개인정보 원문", "민감 식별자"],
      metadata: input.metadata,
      createdAt,
    });
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return false;
    throw error;
  }
}

export async function recordOperationalPermissionChangeEvent(env: PostgresEnv | undefined, input: OperationalPermissionChangeEventInput) {
  const sql = createOperationalSql(env);
  if (!sql) return false;

  const createdAt = input.createdAt ?? new Date().toISOString();
  try {
    await sql`
      insert into permission_change_logs (id, company_id, actor_user_id, target_role_code, target_feature_key, permission_codes, enabled, reason, metadata_json, created_at)
      values (
        ${buildAuditId("permission_change", `${input.targetRoleCode}_${input.targetFeatureKey}`)},
        ${input.companyId},
        ${input.actorUserId},
        ${input.targetRoleCode},
        ${input.targetFeatureKey},
        ${input.permissionCodes}::text[],
        ${input.enabled},
        ${input.reason},
        ${toJsonb(input.metadata)}::jsonb,
        ${createdAt}::timestamptz
      )
    `;

    return recordOperationalAuditEvent(env, {
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      action: "admin.permissions.feature.update",
      resourceType: "role_assignment",
      resourceId: `${input.targetRoleCode}:${input.targetFeatureKey}`,
      category: "permission",
      reason: input.reason,
      after: {
        targetRoleCode: input.targetRoleCode,
        targetFeatureKey: input.targetFeatureKey,
        enabled: input.enabled,
        permissionCount: input.permissionCodes.length,
      },
      maskedFields: ["권한 대상 사용자 상세", "민감 권한 사유 원문"],
      metadata: input.metadata,
      createdAt,
    });
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return false;
    throw error;
  }
}
