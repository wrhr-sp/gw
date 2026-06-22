import type { AdminAuditCategory, AdminAuditLog, AdminAuditMetadata, AdminAuditSource, AdminAuditTargetType, AdminScope, AdminUserSummary, Permission, RoleCode } from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

const roleCodes = new Set<RoleCode>(["SUPER_ADMIN", "COMPANY_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE", "AUDITOR"]);

function parseRoleCodes(value: unknown): RoleCode[] {
  if (!Array.isArray(value)) {
    return ["EMPLOYEE"];
  }

  const parsed = value.filter((item): item is RoleCode => typeof item === "string" && roleCodes.has(item as RoleCode));
  return parsed.length > 0 ? parsed : ["EMPLOYEE"];
}

function resolveAdminScope(roleCodes: RoleCode[]): AdminScope {
  if (roleCodes.includes("SUPER_ADMIN")) {
    return "global";
  }
  if (roleCodes.includes("AUDITOR")) {
    return "audit";
  }
  return "company";
}

function parseAdminAuditSource(value: unknown): AdminAuditSource {
  return value === "web-admin" || value === "api-admin" || value === "system-placeholder" ? value : "api-admin";
}

function parseAdminAuditTargetType(value: string): AdminAuditTargetType {
  switch (value) {
    case "user":
    case "role_assignment":
    case "policy_documents":
    case "policy_boards":
    case "document_space":
    case "document_file":
    case "document_policy":
    case "board_policy":
    case "audit_log":
      return value;
    case "board":
      return "board_policy";
    default:
      return "audit_log";
  }
}

function parseAdminAuditCategory(resourceType: string, metadata: Record<string, unknown>): AdminAuditCategory {
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

function buildAdminAuditMetadata(resourceType: string, metadata: Record<string, unknown>, beforeJson: unknown, afterJson: unknown): AdminAuditMetadata {
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

  return {
    category: parseAdminAuditCategory(resourceType, metadata),
    reason: typeof metadata.reason === "string" ? metadata.reason : "운영 DB 감사 로그 preview",
    before: stringifyAuditSnapshot(beforeJson ?? metadata.before, "이전 상태는 마스킹된 preview 로만 제공합니다."),
    after: stringifyAuditSnapshot(afterJson ?? metadata.after, "이후 상태는 마스킹된 preview 로만 제공합니다."),
    maskedFields: maskedFields.length > 0 ? maskedFields : ["민감 원문", "식별자 일부"],
    companyBoundary: { enforced: true },
    source: parseAdminAuditSource(metadata.source),
    storageRef,
    sensitiveMasked: true,
  };
}

export async function listOperationalAdminAuditLogs(env: PostgresEnv | undefined, companyId: string): Promise<AdminAuditLog[] | null> {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  let rows;
  try {
    rows = await sql`
      select
        al.id,
        al.company_id,
        coalesce(e.id, al.actor_user_id, 'system') as actor_employee_id,
        coalesce(al.actor_user_id, 'system') as actor_user_id,
        al.action,
        al.resource_type,
        coalesce(al.resource_id, al.id) as resource_id,
        al.before_json,
        al.after_json,
        coalesce(al.metadata_json, '{}'::jsonb) as metadata_json,
        al.created_at
      from audit_logs al
      left join employees e on e.user_id = al.actor_user_id and e.company_id = al.company_id and e.deleted_at is null
      where al.company_id = ${companyId}
      order by al.created_at desc, al.id desc
    `;
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) {
      return null;
    }
    throw error;
  }

  return rows.map((row) => {
    const typed = row as {
      id: string;
      company_id: string;
      actor_employee_id: string;
      actor_user_id: string;
      action: string;
      resource_type: string;
      resource_id: string;
      before_json: unknown;
      after_json: unknown;
      metadata_json: unknown;
      created_at: string | Date;
    };
    const metadata = typed.metadata_json && typeof typed.metadata_json === "object" ? (typed.metadata_json as Record<string, unknown>) : {};

    return {
      id: typed.id,
      companyId: typed.company_id,
      actorUserId: typed.actor_user_id,
      actorEmployeeId: typed.actor_employee_id,
      action: typed.action,
      targetType: parseAdminAuditTargetType(typed.resource_type),
      targetId: typed.resource_id,
      createdAt: typed.created_at instanceof Date ? typed.created_at.toISOString() : String(typed.created_at),
      metadata: buildAdminAuditMetadata(typed.resource_type, metadata, typed.before_json, typed.after_json),
    } satisfies AdminAuditLog;
  });
}

export async function listOperationalAdminUsers(
  env: PostgresEnv | undefined,
  companyId: string,
  permissionsForRole: (roleCode: RoleCode) => Permission["code"][],
  highRiskPermissions: readonly Permission["code"][],
): Promise<AdminUserSummary[] | null> {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const rows = await sql`
    select
      u.id as user_id,
      coalesce(e.id, '') as employee_id,
      u.company_id,
      coalesce(e.full_name, u.display_name) as full_name,
      u.email,
      coalesce(d.name, '미지정') as department_name,
      coalesce(e.employment_status, 'active') as employment_status,
      coalesce(json_agg(distinct r.code) filter (where r.code is not null), '[]'::json) as role_codes
    from users u
    left join employees e on e.user_id = u.id and e.company_id = u.company_id
    left join departments d on d.id = e.department_id and d.company_id = e.company_id
    left join user_roles ur on ur.user_id = u.id and ur.company_id = u.company_id and ur.status = 'active'
    left join roles r on r.id = ur.role_id and r.company_id = ur.company_id and r.status = 'active'
    where u.company_id = ${companyId}
      and u.status = 'active'
    group by u.id, u.company_id, e.id, e.full_name, u.display_name, u.email, d.name, e.employment_status
    order by coalesce(e.full_name, u.display_name), u.email
  `;

  return rows.map((row) => {
    const typed = row as {
      user_id: string;
      employee_id: string;
      company_id: string;
      full_name: string;
      email: string;
      department_name: string;
      employment_status: "active" | "on_leave" | "offboarded";
      role_codes: unknown;
    };
    const parsedRoleCodes = parseRoleCodes(typed.role_codes);
    const permissions = [...new Set(parsedRoleCodes.flatMap((roleCode) => permissionsForRole(roleCode)))];
    const highRisk = permissions.filter((permission) => highRiskPermissions.includes(permission));

    return {
      userId: typed.user_id,
      employeeId: typed.employee_id || typed.user_id,
      companyId: typed.company_id,
      fullName: typed.full_name,
      email: typed.email,
      departmentName: typed.department_name,
      roleCodes: parsedRoleCodes,
      permissions,
      employmentStatus: typed.employment_status,
      adminScope: resolveAdminScope(parsedRoleCodes),
      employeeLinkStatus: typed.employee_id ? "linked" : "unlinked",
      highRiskPermissions: highRisk,
      statusChangePreview: {
        currentStatus: typed.employment_status,
        nextStatus: typed.employment_status === "active" ? "on_leave" : "active",
        reasonRequired: true,
      },
      roleChangePreview: {
        currentRoleCodes: parsedRoleCodes,
        nextRoleCodes: parsedRoleCodes,
        auditCandidate: true,
      },
      placeholder: true,
    } satisfies AdminUserSummary;
  });
}
