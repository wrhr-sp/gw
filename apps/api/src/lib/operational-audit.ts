import type { AdminAuditCategory, AdminAuditMetadata, AdminAuditSource } from "@gw/shared";
import { sanitizeDocumentAuditSnapshot } from "./document-audit";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

type OperationalAuditMetadataInput = Record<string, unknown>;

type OperationalAuditAppendInput = {
  id: string;
  companyId: string;
  branchId?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  beforeJson?: unknown;
  afterJson?: unknown;
  metadata?: OperationalAuditMetadataInput;
  createdAt: string;
};

function parseAdminAuditSource(value: unknown): AdminAuditSource {
  return value === "web-admin" || value === "api-admin" || value === "system-placeholder" ? value : "api-admin";
}

function parseAdminAuditCategory(resourceType: string, metadata: OperationalAuditMetadataInput): AdminAuditCategory {
  const candidate = metadata.category;
  if (
    candidate === "user" ||
    candidate === "permission" ||
    candidate === "policy" ||
    candidate === "document_space" ||
    candidate === "document_file" ||
    candidate === "board" ||
    candidate === "audit"
  ) {
    return candidate;
  }

  switch (resourceType) {
    case "user":
      return "user";
    case "role_assignment":
      return "permission";
    case "document_space":
      return "document_space";
    case "document_file":
      return "document_file";
    case "policy_documents":
    case "document_policy":
      return "policy";
    case "policy_boards":
    case "board_policy":
    case "board":
    case "post":
    case "comment":
      return "board";
    default:
      return "audit";
  }
}

function stringifyAuditSnapshot(value: unknown, fallback: string) {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function sanitizeAuditSnapshot(resourceType: string, value: unknown) {
  if (resourceType !== "document_file") {
    return value;
  }

  return sanitizeDocumentAuditSnapshot(value);
}

export function buildOperationalAuditMetadata(
  resourceType: string,
  metadata: OperationalAuditMetadataInput = {},
  beforeJson?: unknown,
  afterJson?: unknown,
): AdminAuditMetadata {
  const maskedFields = Array.isArray(metadata.maskedFields)
    ? metadata.maskedFields.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];

  const storageRefCandidate = metadata.storageRef;
  const storageStatus =
    storageRefCandidate && typeof storageRefCandidate === "object"
      ? (storageRefCandidate as Record<string, unknown>).storageStatus
      : undefined;
  const normalizedStorageStatus =
    storageStatus === "pending" || storageStatus === "linked" || storageStatus === "failed" || storageStatus === "deleted"
      ? storageStatus
      : undefined;
  const storageRef: AdminAuditMetadata["storageRef"] =
    storageRefCandidate &&
    typeof storageRefCandidate === "object" &&
    typeof (storageRefCandidate as Record<string, unknown>).fileId === "string" &&
    typeof (storageRefCandidate as Record<string, unknown>).spaceId === "string" &&
    typeof (storageRefCandidate as Record<string, unknown>).versionId === "string" &&
    normalizedStorageStatus
      ? {
          fileId: (storageRefCandidate as Record<string, unknown>).fileId as string,
          spaceId: (storageRefCandidate as Record<string, unknown>).spaceId as string,
          versionId: (storageRefCandidate as Record<string, unknown>).versionId as string,
          storageStatus: normalizedStorageStatus,
        }
      : undefined;

  const sanitizedBefore = sanitizeAuditSnapshot(resourceType, beforeJson ?? metadata.before);
  const sanitizedAfter = sanitizeAuditSnapshot(resourceType, afterJson ?? metadata.after);

  return {
    category: parseAdminAuditCategory(resourceType, metadata),
    reason: typeof metadata.reason === "string" ? metadata.reason : "운영 DB 감사 로그 preview",
    before: stringifyAuditSnapshot(sanitizedBefore, "이전 상태는 마스킹된 preview 로만 제공합니다."),
    after: stringifyAuditSnapshot(sanitizedAfter, "이후 상태는 마스킹된 preview 로만 제공합니다."),
    maskedFields: maskedFields.length > 0 ? maskedFields : ["민감 원문", "식별자 일부"],
    companyBoundary: { enforced: true },
    source: parseAdminAuditSource(metadata.source),
    storageRef,
    sensitiveMasked: true,
  };
}

export async function appendOperationalAuditLog(env: PostgresEnv | undefined, input: OperationalAuditAppendInput) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  try {
    await sql`
      insert into audit_logs (
        id,
        company_id,
        branch_id,
        actor_user_id,
        action,
        resource_type,
        resource_id,
        before_json,
        after_json,
        metadata_json,
        created_at
      )
      values (
        ${input.id},
        ${input.companyId},
        ${input.branchId ?? null},
        ${input.actorUserId ?? null},
        ${input.action},
        ${input.resourceType},
        ${input.resourceId ?? null},
        ${input.beforeJson === undefined ? null : input.beforeJson}::jsonb,
        ${input.afterJson === undefined ? null : input.afterJson}::jsonb,
        ${JSON.stringify(buildOperationalAuditMetadata(input.resourceType, input.metadata, input.beforeJson, input.afterJson))}::jsonb,
        ${input.createdAt}::timestamptz
      )
      on conflict (id) do nothing
    `;
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) {
      return null;
    }
    throw error;
  }

  return { id: input.id };
}

export async function resetOperationalAuditLogs(env: PostgresEnv | undefined, companyId: string) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  try {
    await sql`
      delete from audit_logs
      where company_id = ${companyId}
    `;
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) {
      return null;
    }
    throw error;
  }

  return { companyId };
}
