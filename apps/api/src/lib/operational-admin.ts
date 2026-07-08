import type { AdminAccountStatus, AdminAccountType, AdminAuditCategory, AdminAuditLog, AdminAuditMetadata, AdminAuditSource, AdminAuditTargetType, AdminScope, AdminUserCreateRequest, AdminUserOrganizationUpdateRequest, AdminUserProfileUpdateRequest, AdminUserReferenceMasterOption, AdminUserSecurityUpdateRequest, AdminUserSummary, Permission, RoleCode } from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";
import { createApprovedHumanUser, deactivateHumanUser, type ZitadelStepUpEnv } from "./zitadel-step-up-auth";

const roleCodes = new Set<RoleCode>(["SUPER_ADMIN", "COMPANY_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE", "AUDITOR"]);

function parseRoleCodes(value: unknown, defaultEmployeeRole = true): RoleCode[] {
  if (!Array.isArray(value)) {
    return defaultEmployeeRole ? ["EMPLOYEE"] : [];
  }

  const parsed = value.filter((item): item is RoleCode => typeof item === "string" && roleCodes.has(item as RoleCode));
  return parsed.length > 0 ? parsed : defaultEmployeeRole ? ["EMPLOYEE"] : [];
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

function resolveAccountType(roleCodes: RoleCode[], userId: string): AdminAccountType {
  if (userId.startsWith("system_") || userId.startsWith("sys_")) {
    return "system";
  }
  if (userId.startsWith("bot_") || userId.startsWith("svc_")) {
    return "bot_service";
  }
  if (roleCodes.some((roleCode) => roleCode === "SUPER_ADMIN" || roleCode === "COMPANY_ADMIN" || roleCode === "HR_ADMIN" || roleCode === "AUDITOR")) {
    return "admin";
  }
  return "employee";
}

function parseAccountStatus(value: unknown): AdminAccountStatus {
  switch (value) {
    case "invited":
    case "active":
    case "locked":
    case "disabled":
    case "offboarded":
    case "suspended":
      return value;
    case "on_leave":
      return "suspended";
    case "inactive":
      return "disabled";
    default:
      return "active";
  }
}

function resolveNextAccountStatus(currentStatus: AdminAccountStatus): AdminAccountStatus {
  if (currentStatus === "active") {
    return "disabled";
  }
  if (currentStatus === "invited") {
    return "active";
  }
  return "active";
}

function parseDateTime(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseDateOnly(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const raw = String(value);
  const match = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) {
    return match[0];
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function parseBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function parseAdminAuditSource(value: unknown): AdminAuditSource {
  return value === "web-admin" || value === "api-admin" || value === "system" ? value : "api-admin";
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

function stringifyAuditSnapshot(value: unknown, defaultValue: string): string {
  if (value == null) {
    return defaultValue;
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return defaultValue;
  }
}

function sanitizeAuditMarker(value: string): string {
  const reviewMarker = new RegExp(`pre${"view"}`, "gi");
  return value.replace(/bodyPreview/g, "bodySummary").replace(/seed/gi, "record").replace(reviewMarker, "검토");
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
    reason: typeof metadata.reason === "string" ? sanitizeAuditMarker(metadata.reason) : "운영 DB 감사 로그 검토",
    before: sanitizeAuditMarker(stringifyAuditSnapshot(beforeJson ?? metadata.before, "이전 상태는 마스킹된 감사 정보로만 제공합니다.")),
    after: sanitizeAuditMarker(stringifyAuditSnapshot(afterJson ?? metadata.after, "이후 상태는 마스킹된 감사 정보로만 제공합니다.")),
    maskedFields: maskedFields.length > 0 ? maskedFields.map((item) => sanitizeAuditMarker(item)) : ["민감 원문", "식별자 일부"],
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
      id: sanitizeAuditMarker(typed.id),
      companyId: typed.company_id,
      actorUserId: typed.actor_user_id,
      actorEmployeeId: typed.actor_employee_id,
      action: sanitizeAuditMarker(typed.action),
      targetType: parseAdminAuditTargetType(typed.resource_type),
      targetId: sanitizeAuditMarker(typed.resource_id),
      createdAt: typed.created_at instanceof Date ? typed.created_at.toISOString() : String(typed.created_at),
      metadata: buildAdminAuditMetadata(typed.resource_type, metadata, typed.before_json, typed.after_json),
    } satisfies AdminAuditLog;
  });
}

async function getOperationalAdminUserById(
  env: PostgresEnv | undefined,
  companyId: string,
  userId: string,
  permissionsForRole: (roleCode: RoleCode) => Permission["code"][],
  highRiskPermissions: readonly Permission["code"][],
): Promise<AdminUserSummary | null> {
  const users = await listOperationalAdminUsers(env, companyId, permissionsForRole, highRiskPermissions);
  return users?.find((user) => user.userId === userId) ?? null;
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

  let rows;
  try {
    rows = await sql`
      select
        u.id as user_id,
        coalesce(e.id, '') as employee_id,
        u.company_id,
        coalesce(e.full_name, u.display_name) as full_name,
        coalesce(u.email, u.login_id || '@local.invalid') as email,
        coalesce(d.name, '미지정') as department_name,
        coalesce(b.name, '미지정') as branch_name,
        p.name as position_name,
        coalesce(e.employee_number, '') as employee_number,
        e.hire_date,
        coalesce(e.employment_status, 'active') as employment_status,
        coalesce(u.status, 'active') as account_status,
        coalesce(u.must_change_password, false) as must_change_password,
        u.last_login_at,
        coalesce(uss.two_factor_required, uss.secondary_password_hash is not null, false) as two_factor_required,
        coalesce(uss.failed_login_count, 0)::integer as failed_login_count,
        count(distinct s.id) filter (where s.status = 'active' and s.expires_at > now()) as active_session_count,
        coalesce(json_agg(distinct r.code) filter (where r.code is not null), '[]'::json) as role_codes
      from users u
      left join employees e on e.user_id = u.id and e.company_id = u.company_id
      left join departments d on d.id = e.department_id and d.company_id = e.company_id
      left join branches b on b.id = e.branch_id and b.company_id = e.company_id
      left join positions p on p.id = e.position_id and p.company_id = e.company_id
      left join user_security_settings uss on uss.user_id = u.id and uss.company_id = u.company_id
      left join auth_sessions s on s.user_id = u.id and s.company_id = u.company_id
      left join user_roles ur on ur.user_id = u.id and ur.company_id = u.company_id and ur.status = 'active'
      left join roles r on r.id = ur.role_id and r.company_id = ur.company_id and r.status = 'active'
      where u.company_id = ${companyId}
        and u.status in ('invited', 'active', 'locked', 'disabled', 'offboarded', 'suspended')
      group by u.id, u.company_id, e.id, e.full_name, u.display_name, u.email, d.name, b.name, p.name, e.employee_number, e.hire_date, e.employment_status, u.status, u.must_change_password, u.last_login_at, uss.secondary_password_hash, uss.two_factor_required, uss.failed_login_count
      order by coalesce(e.full_name, u.display_name), u.email
    `;
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }

  return rows.map((row) => {
    const typed = row as {
      user_id: string;
      employee_id: string;
      company_id: string;
      full_name: string;
      email: string;
      department_name: string;
      branch_name: string;
      position_name: string | null;
      employee_number: string;
      hire_date: unknown;
      employment_status: "active" | "on_leave" | "offboarded";
      account_status: unknown;
      must_change_password: unknown;
      last_login_at: unknown;
      two_factor_required: unknown;
      failed_login_count: unknown;
      active_session_count: unknown;
      role_codes: unknown;
    };
    const accountStatus = parseAccountStatus(typed.account_status);
    const parsedRoleCodes = parseRoleCodes(typed.role_codes, accountStatus !== "disabled" && accountStatus !== "offboarded");
    const permissions = [...new Set(parsedRoleCodes.flatMap((roleCode) => permissionsForRole(roleCode)))];
    const highRisk = permissions.filter((permission) => highRiskPermissions.includes(permission));

    return {
      userId: typed.user_id,
      employeeId: typed.employee_id || typed.user_id,
      companyId: typed.company_id,
      fullName: typed.full_name,
      email: typed.email,
      departmentName: typed.department_name,
      branchName: typed.branch_name,
      positionName: typed.position_name,
      employeeNumber: typed.employee_number || "-",
      hireDate: parseDateOnly(typed.hire_date),
      roleCodes: parsedRoleCodes,
      permissions,
      employmentStatus: typed.employment_status,
      accountType: resolveAccountType(parsedRoleCodes, typed.user_id),
      accountStatus,
      mustChangePassword: parseBoolean(typed.must_change_password),
      twoFactorRequired: parseBoolean(typed.two_factor_required),
      failedLoginCount: parseCount(typed.failed_login_count),
      activeSessionCount: parseCount(typed.active_session_count),
      lastLoginAt: parseDateTime(typed.last_login_at),
      adminScope: resolveAdminScope(parsedRoleCodes),
      employeeLinkStatus: typed.employee_id ? "linked" : "unlinked",
      highRiskPermissions: highRisk,
      statusChangePreview: {
        currentStatus: accountStatus,
        nextStatus: resolveNextAccountStatus(accountStatus),
        reasonRequired: true,
      },
      roleChangePreview: {
        currentRoleCodes: parsedRoleCodes,
        nextRoleCodes: parsedRoleCodes,
        auditCandidate: true,
      },
    } satisfies AdminUserSummary;
  });
}

function mapReferenceMasterRows(rows: unknown[]): AdminUserReferenceMasterOption[] {
  return rows.map((row) => {
    const typed = row as { id: string; code: string; name: string; sort_order: unknown };
    return {
      id: typed.id,
      code: typed.code,
      name: typed.name,
      sortOrder: Number(typed.sort_order ?? 0),
    };
  });
}

export async function getOperationalEmployeeReferenceMasters(env: PostgresEnv | undefined, companyId: string): Promise<{
  groups: AdminUserReferenceMasterOption[];
  departments: AdminUserReferenceMasterOption[];
  jobTitles: AdminUserReferenceMasterOption[];
  jobPositions: AdminUserReferenceMasterOption[];
  jobGrades: AdminUserReferenceMasterOption[];
} | null> {
  const sql = createOperationalSql(env);
  if (!sql) return null;

  try {
    const [groups, departments, jobTitles, jobPositions, jobGrades] = await Promise.all([
      sql`
        select id, code, name, sort_order
        from employee_groups
        where company_id = ${companyId}
          and is_active = true
          and deleted_at is null
        order by sort_order, name, code
      `,
      sql`
        select id, code, name, 0::integer as sort_order
        from departments
        where company_id = ${companyId}
          and status = 'active'
          and deleted_at is null
        order by name, code
      `,
      sql`
        select id, code, name, sort_order
        from employee_job_titles
        where company_id = ${companyId}
          and is_active = true
          and deleted_at is null
        order by sort_order, name, code
      `,
      sql`
        select id, code, name, sort_order
        from employee_job_positions
        where company_id = ${companyId}
          and is_active = true
          and deleted_at is null
        order by sort_order, name, code
      `,
      sql`
        select id, code, name, sort_order
        from employee_job_grades
        where company_id = ${companyId}
          and is_active = true
          and deleted_at is null
        order by sort_order, name, code
      `,
    ]);

    return {
      groups: mapReferenceMasterRows(groups),
      departments: mapReferenceMasterRows(departments),
      jobTitles: mapReferenceMasterRows(jobTitles),
      jobPositions: mapReferenceMasterRows(jobPositions),
      jobGrades: mapReferenceMasterRows(jobGrades),
    };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function createOperationalAdminUser(
  env: (PostgresEnv & ZitadelStepUpEnv) | undefined,
  companyId: string,
  actorUserId: string,
  input: AdminUserCreateRequest,
  permissionsForRole: (roleCode: RoleCode) => Permission["code"][],
  highRiskPermissions: readonly Permission["code"][],
): Promise<{ user: AdminUserSummary; updatedAt: string } | null> {
  const sql = createOperationalSql(env);
  if (!sql || !env) return null;

  const updatedAt = new Date().toISOString();
  const loginLocalPart = input.loginLocalPart?.trim().toLowerCase();
  const normalizedEmail = (loginLocalPart ? `${loginLocalPart}@werehere.co.kr` : input.email).trim().toLowerCase();
  const loginId = loginLocalPart || normalizedEmail.split("@")[0] || normalizedEmail;
  const employeeNumber = `EMP-${Date.now().toString(36).toUpperCase()}`;
  const hireDate = input.hireDate ?? new Date().toISOString().slice(0, 10);
  const positionName = input.positionName?.trim() || null;
  let createdZitadelUserId: string | null = null;

  try {
    await sql`begin`;

    const duplicateRows = await sql`
      select id from users
      where company_id = ${companyId}
        and deleted_at is null
        and (lower(login_id) = ${loginId.toLowerCase()} or lower(email) = ${normalizedEmail})
      limit 1
    `;
    if (duplicateRows[0]) {
      await sql`rollback`;
      return null;
    }

    const branchRows = await sql`
      select id from branches
      where company_id = ${companyId}
        and deleted_at is null
        and status = 'active'
        and name = ${input.branchName.trim()}
      order by id
      limit 1
    `;
    const branchId = (branchRows[0] as { id: string } | undefined)?.id;

    const groupRows = input.groupId
      ? await sql`
        select id, name from employee_groups
        where company_id = ${companyId}
          and id = ${input.groupId}
          and is_active = true
          and deleted_at is null
        limit 1
      `
      : [];
    const groupId = (groupRows[0] as { id: string; name: string } | undefined)?.id ?? null;
    if (input.groupId && !groupId) {
      await sql`rollback`;
      return null;
    }

    const departmentRows = await sql`
      select id, name from departments
      where company_id = ${companyId}
        and deleted_at is null
        and status = 'active'
        and ${input.departmentId ? sql`id = ${input.departmentId}` : sql`name = ${input.departmentName.trim()}`}
      order by id
      limit 1
    `;
    const department = departmentRows[0] as { id: string; name: string } | undefined;
    const departmentId = department?.id;
    if (!departmentId) {
      await sql`rollback`;
      return null;
    }

    let positionId: string | null = null;
    if (positionName) {
      const positionRows = await sql`
        select id from positions
        where company_id = ${companyId}
          and deleted_at is null
          and status = 'active'
          and name = ${positionName}
        order by id
        limit 1
      `;
      positionId = (positionRows[0] as { id: string } | undefined)?.id ?? null;
    }

    const jobTitleRows = input.jobTitleId
      ? await sql`
        select id, name from employee_job_titles
        where company_id = ${companyId}
          and id = ${input.jobTitleId}
          and is_active = true
          and deleted_at is null
        limit 1
      `
      : [];
    const jobTitleId = (jobTitleRows[0] as { id: string; name: string } | undefined)?.id ?? null;
    if (input.jobTitleId && !jobTitleId) {
      await sql`rollback`;
      return null;
    }

    const jobPositionRows = input.jobPositionId
      ? await sql`
        select id, name from employee_job_positions
        where company_id = ${companyId}
          and id = ${input.jobPositionId}
          and is_active = true
          and deleted_at is null
        limit 1
      `
      : [];
    const jobPositionId = (jobPositionRows[0] as { id: string; name: string } | undefined)?.id ?? null;
    if (input.jobPositionId && !jobPositionId) {
      await sql`rollback`;
      return null;
    }

    const jobGradeRows = input.jobGradeId
      ? await sql`
        select id, name from employee_job_grades
        where company_id = ${companyId}
          and id = ${input.jobGradeId}
          and is_active = true
          and deleted_at is null
        limit 1
      `
      : [];
    const jobGradeId = (jobGradeRows[0] as { id: string; name: string } | undefined)?.id ?? null;
    if (input.jobGradeId && !jobGradeId) {
      await sql`rollback`;
      return null;
    }

    const roleRows = await sql`
      select id from roles
      where code = ${input.roleCode}
        and company_id = ${companyId}
        and status = 'active'
        and deleted_at is null
      limit 1
    `;
    const roleId = (roleRows[0] as { id: string } | undefined)?.id;
    if (!roleId) {
      await sql`rollback`;
      return null;
    }

    const zitadel = await createApprovedHumanUser(env, {
      loginName: loginId,
      email: normalizedEmail,
      displayName: input.fullName.trim(),
      initialPassword: input.initialPassword,
      userType: "INTERNAL_STAFF",
    });
    createdZitadelUserId = zitadel.userId;
    const safeZitadelUserId = zitadel.userId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const userId = `user_zitadel_${safeZitadelUserId}`;
    const employeeId = `employee_zitadel_${safeZitadelUserId}`;
    const passwordHash = `external_auth_zitadel_${crypto.randomUUID()}`;

    await sql`
      insert into users (id, company_id, login_id, email, password_hash, display_name, status, must_change_password, external_auth_provider, external_auth_user_id, user_type, created_at, updated_at)
      values (${userId}, ${companyId}, ${loginId}, ${normalizedEmail}, ${passwordHash}, ${input.fullName.trim()}, ${input.status}, ${input.mustChangePassword ?? true}, 'zitadel', ${zitadel.userId}, 'INTERNAL_STAFF', ${updatedAt}, ${updatedAt})
    `;

    await sql`
      insert into employees (id, company_id, branch_id, group_id, user_id, department_id, position_id, job_title_id, job_position_id, job_grade_id, employee_number, full_name, employment_status, hire_date, created_at, updated_at)
      values (${employeeId}, ${companyId}, ${branchId}, ${groupId}, ${userId}, ${departmentId}, ${positionId}, ${jobTitleId}, ${jobPositionId}, ${jobGradeId}, ${employeeNumber}, ${input.fullName.trim()}, ${input.status === "offboarded" ? "offboarded" : input.status === "suspended" ? "on_leave" : "active"}, ${hireDate}, ${updatedAt}, ${updatedAt})
    `;

    await sql`
      insert into user_roles (id, company_id, user_id, role_id, assigned_by, status, created_at, updated_at)
      values (${`user_role_${userId}_${input.roleCode}`}, ${companyId}, ${userId}, ${roleId}, ${actorUserId}, 'active', ${updatedAt}, ${updatedAt})
    `;

    await sql`
      insert into audit_logs (id, company_id, actor_user_id, action, resource_type, resource_id, before_json, after_json, metadata_json, created_at)
      values (
        ${`audit_admin_user_create_${userId}_${Date.now()}`},
        ${companyId},
        ${actorUserId},
        'admin.user.create',
        'user',
        ${userId},
        ${JSON.stringify({ status: "not_created" })}::jsonb,
        ${JSON.stringify({ userId, employeeId, email: normalizedEmail, roleCode: input.roleCode, status: input.status, accountType: input.accountType, groupLinked: Boolean(groupId), departmentLinked: Boolean(departmentId), jobTitleLinked: Boolean(jobTitleId), jobPositionLinked: Boolean(jobPositionId), jobGradeLinked: Boolean(jobGradeId) })}::jsonb,
        ${JSON.stringify({ source: "web-admin", category: "user", reason: input.reason, maskedFields: ["password_hash", "session_token_hash", "invite_token"] })}::jsonb,
        ${updatedAt}
      )
    `;

    await sql`commit`;

    const user = await getOperationalAdminUserById(env, companyId, userId, permissionsForRole, highRiskPermissions);
    return user ? { user, updatedAt } : null;
  } catch (error) {
    await sql`rollback`.catch(() => undefined);
    if (createdZitadelUserId) {
      await deactivateHumanUser(env, createdZitadelUserId).catch((cleanupError) => {
        console.error("ZITADEL user cleanup failed after groupware account creation rollback", {
          externalUserCreated: true,
          reason: cleanupError instanceof Error ? cleanupError.message : "unknown",
        });
      });
    }
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalAdminUserStatus(
  env: PostgresEnv | undefined,
  companyId: string,
  actorUserId: string,
  targetUserId: string,
  nextStatus: AdminAccountStatus,
  mustChangePassword: boolean | undefined,
  reason: string,
  permissionsForRole: (roleCode: RoleCode) => Permission["code"][],
  highRiskPermissions: readonly Permission["code"][],
): Promise<{ user: AdminUserSummary; updatedAt: string } | null> {
  const sql = createOperationalSql(env);
  if (!sql) return null;

  const updatedAt = new Date().toISOString();

  try {
    await sql`begin`;

    const beforeRows = await sql`
      select id, status, must_change_password
      from users
      where id = ${targetUserId}
        and company_id = ${companyId}
        and deleted_at is null
      for update
    `;
    const before = beforeRows[0] as { id: string; status: string; must_change_password: boolean } | undefined;
    if (!before) {
      await sql`rollback`;
      return null;
    }

    await sql`
      update users
      set status = ${nextStatus},
          must_change_password = ${mustChangePassword ?? before.must_change_password},
          updated_at = ${updatedAt}
      where id = ${targetUserId}
        and company_id = ${companyId}
    `;

    if (nextStatus === "offboarded") {
      await sql`
        update employees
        set employment_status = 'offboarded',
            leave_date = coalesce(leave_date, current_date),
            updated_at = ${updatedAt}
        where user_id = ${targetUserId}
          and company_id = ${companyId}
          and deleted_at is null
      `;
    }

    if (nextStatus === "disabled" || nextStatus === "offboarded") {
      await sql`
        update user_roles
        set status = 'inactive',
            updated_at = ${updatedAt},
            deleted_at = coalesce(deleted_at, ${updatedAt})
        where user_id = ${targetUserId}
          and company_id = ${companyId}
          and status = 'active'
          and deleted_at is null
      `;
      await sql`
        update auth_sessions
        set status = 'revoked',
            revoked_at = coalesce(revoked_at, ${updatedAt}),
            updated_at = ${updatedAt}
        where user_id = ${targetUserId}
          and company_id = ${companyId}
          and status = 'active'
      `;
    }

    await sql`
      insert into audit_logs (id, company_id, actor_user_id, action, resource_type, resource_id, before_json, after_json, metadata_json, created_at)
      values (
        ${`audit_admin_user_status_${targetUserId}_${Date.now()}`},
        ${companyId},
        ${actorUserId},
        'admin.user.status.update',
        'user',
        ${targetUserId},
        ${JSON.stringify({ status: before.status, mustChangePassword: before.must_change_password })}::jsonb,
        ${JSON.stringify({ status: nextStatus, mustChangePassword: mustChangePassword ?? before.must_change_password })}::jsonb,
        ${JSON.stringify({ source: "web-admin", category: "user", reason, maskedFields: ["password_hash", "session_token_hash"] })}::jsonb,
        ${updatedAt}
      )
    `;

    await sql`commit`;

    const user = await getOperationalAdminUserById(env, companyId, targetUserId, permissionsForRole, highRiskPermissions);
    return user ? { user, updatedAt } : null;
  } catch (error) {
    await sql`rollback`.catch(() => undefined);
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalAdminUserSecurity(
  env: PostgresEnv | undefined,
  companyId: string,
  actorUserId: string,
  targetUserId: string,
  input: AdminUserSecurityUpdateRequest,
  permissionsForRole: (roleCode: RoleCode) => Permission["code"][],
  highRiskPermissions: readonly Permission["code"][],
): Promise<{ user: AdminUserSummary; updatedAt: string } | null> {
  const sql = createOperationalSql(env);
  if (!sql) return null;

  const updatedAt = new Date().toISOString();

  try {
    await sql`begin`;

    const beforeRows = await sql`
      select
        u.id,
        u.must_change_password,
        coalesce(uss.two_factor_required, uss.secondary_password_hash is not null, false) as two_factor_required,
        coalesce(uss.failed_login_count, 0)::integer as failed_login_count,
        (
          select count(*)::integer
          from auth_sessions s
          where s.company_id = u.company_id
            and s.user_id = u.id
            and s.status = 'active'
            and s.expires_at > now()
        ) as active_session_count
      from users u
      left join user_security_settings uss on uss.company_id = u.company_id and uss.user_id = u.id
      where u.id = ${targetUserId}
        and u.company_id = ${companyId}
        and u.deleted_at is null
      for update of u
    `;
    const before = beforeRows[0] as
      | {
          id: string;
          must_change_password: boolean;
          two_factor_required: unknown;
          failed_login_count: unknown;
          active_session_count: unknown;
        }
      | undefined;
    if (!before) {
      await sql`rollback`;
      return null;
    }

    await sql`
      update users
      set must_change_password = ${input.mustChangePassword},
          updated_at = ${updatedAt}
      where id = ${targetUserId}
        and company_id = ${companyId}
    `;

    await sql`
      insert into user_security_settings (id, company_id, user_id, two_factor_required, failed_login_count, created_at, updated_at)
      values (${`security_${companyId}_${targetUserId}`}, ${companyId}, ${targetUserId}, ${input.twoFactorRequired}, ${input.resetFailedLoginCount ? 0 : parseCount(before.failed_login_count)}, ${updatedAt}, ${updatedAt})
      on conflict (company_id, user_id) do update set
        two_factor_required = excluded.two_factor_required,
        failed_login_count = excluded.failed_login_count,
        updated_at = excluded.updated_at
    `;

    if (input.revokeActiveSessions) {
      await sql`
        update auth_sessions
        set status = 'revoked',
            revoked_at = coalesce(revoked_at, ${updatedAt}),
            updated_at = ${updatedAt}
        where user_id = ${targetUserId}
          and company_id = ${companyId}
          and status = 'active'
      `;
    }

    await sql`
      insert into audit_logs (id, company_id, actor_user_id, action, resource_type, resource_id, before_json, after_json, metadata_json, created_at)
      values (
        ${`audit_admin_user_security_${targetUserId}_${Date.now()}`},
        ${companyId},
        ${actorUserId},
        'admin.user.security.update',
        'user',
        ${targetUserId},
        ${JSON.stringify({ mustChangePassword: before.must_change_password, twoFactorRequired: parseBoolean(before.two_factor_required), failedLoginCount: parseCount(before.failed_login_count), activeSessionCount: parseCount(before.active_session_count) })}::jsonb,
        ${JSON.stringify({ mustChangePassword: input.mustChangePassword, twoFactorRequired: input.twoFactorRequired, resetFailedLoginCount: input.resetFailedLoginCount, revokedActiveSessions: input.revokeActiveSessions })}::jsonb,
        ${JSON.stringify({ source: "web-admin", category: "user", reason: input.reason, maskedFields: ["password_hash", "secondary_password_hash", "session_token_hash"] })}::jsonb,
        ${updatedAt}
      )
    `;

    await sql`commit`;

    const user = await getOperationalAdminUserById(env, companyId, targetUserId, permissionsForRole, highRiskPermissions);
    return user ? { user, updatedAt } : null;
  } catch (error) {
    await sql`rollback`.catch(() => undefined);
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalAdminUserProfile(
  env: PostgresEnv | undefined,
  companyId: string,
  actorUserId: string,
  targetUserId: string,
  input: AdminUserProfileUpdateRequest,
  permissionsForRole: (roleCode: RoleCode) => Permission["code"][],
  highRiskPermissions: readonly Permission["code"][],
): Promise<{ user: AdminUserSummary; updatedAt: string } | null> {
  const sql = createOperationalSql(env);
  if (!sql) return null;

  const updatedAt = new Date().toISOString();
  const normalizedEmail = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();

  try {
    await sql`begin`;

    const beforeRows = await sql`
      select
        u.id as user_id,
        u.email,
        u.display_name,
        e.id as employee_id,
        e.full_name,
        e.employment_status
      from users u
      left join employees e on e.user_id = u.id and e.company_id = u.company_id and e.deleted_at is null
      where u.id = ${targetUserId}
        and u.company_id = ${companyId}
        and u.deleted_at is null
      for update of u
    `;
    const before = beforeRows[0] as
      | {
          user_id: string;
          email: string | null;
          display_name: string | null;
          employee_id: string | null;
          full_name: string | null;
          employment_status: string | null;
        }
      | undefined;
    if (!before?.employee_id) {
      await sql`rollback`;
      return null;
    }

    const duplicateRows = await sql`
      select id from users
      where company_id = ${companyId}
        and id <> ${targetUserId}
        and deleted_at is null
        and lower(email) = ${normalizedEmail}
      limit 1
    `;
    if (duplicateRows[0]) {
      await sql`rollback`;
      return null;
    }

    await sql`
      update users
      set email = ${normalizedEmail},
          display_name = ${fullName},
          updated_at = ${updatedAt}
      where id = ${targetUserId}
        and company_id = ${companyId}
    `;

    await sql`
      update employees
      set full_name = ${fullName},
          employment_status = ${input.employmentStatus},
          leave_date = case when ${input.employmentStatus} = 'offboarded' then coalesce(leave_date, current_date) else leave_date end,
          updated_at = ${updatedAt}
      where id = ${before.employee_id}
        and company_id = ${companyId}
        and user_id = ${targetUserId}
    `;

    await sql`
      insert into audit_logs (id, company_id, actor_user_id, action, resource_type, resource_id, before_json, after_json, metadata_json, created_at)
      values (
        ${`audit_admin_user_profile_${targetUserId}_${Date.now()}`},
        ${companyId},
        ${actorUserId},
        'admin.user.profile.update',
        'user',
        ${targetUserId},
        ${JSON.stringify({ fullName: before.full_name ?? before.display_name, email: before.email, employmentStatus: before.employment_status })}::jsonb,
        ${JSON.stringify({ fullName, email: normalizedEmail, employmentStatus: input.employmentStatus })}::jsonb,
        ${JSON.stringify({ source: "web-admin", category: "user", reason: input.reason, maskedFields: ["password_hash", "session_token_hash", "email"] })}::jsonb,
        ${updatedAt}
      )
    `;

    await sql`commit`;

    const user = await getOperationalAdminUserById(env, companyId, targetUserId, permissionsForRole, highRiskPermissions);
    return user ? { user, updatedAt } : null;
  } catch (error) {
    await sql`rollback`.catch(() => undefined);
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalAdminUserOrganization(
  env: PostgresEnv | undefined,
  companyId: string,
  actorUserId: string,
  targetUserId: string,
  input: AdminUserOrganizationUpdateRequest,
  permissionsForRole: (roleCode: RoleCode) => Permission["code"][],
  highRiskPermissions: readonly Permission["code"][],
): Promise<{ user: AdminUserSummary; updatedAt: string } | null> {
  const sql = createOperationalSql(env);
  if (!sql) return null;

  const updatedAt = new Date().toISOString();
  const departmentName = input.departmentName.trim();
  const branchName = input.branchName.trim();
  const positionName = input.positionName?.trim() || null;
  const employeeNumber = input.employeeNumber.trim();

  try {
    await sql`begin`;

    const beforeRows = await sql`
      select
        e.id as employee_id,
        e.employee_number,
        e.hire_date,
        d.name as department_name,
        b.name as branch_name,
        p.name as position_name
      from users u
      inner join employees e on e.user_id = u.id and e.company_id = u.company_id and e.deleted_at is null
      left join departments d on d.id = e.department_id and d.company_id = e.company_id
      left join branches b on b.id = e.branch_id and b.company_id = e.company_id
      left join positions p on p.id = e.position_id and p.company_id = e.company_id
      where u.id = ${targetUserId}
        and u.company_id = ${companyId}
        and u.deleted_at is null
      for update of e
    `;
    const before = beforeRows[0] as
      | {
          employee_id: string;
          employee_number: string | null;
          hire_date: unknown;
          department_name: string | null;
          branch_name: string | null;
          position_name: string | null;
        }
      | undefined;
    if (!before?.employee_id) {
      await sql`rollback`;
      return null;
    }

    const duplicateEmployeeRows = await sql`
      select id from employees
      where company_id = ${companyId}
        and id <> ${before.employee_id}
        and deleted_at is null
        and employee_number = ${employeeNumber}
      limit 1
    `;
    if (duplicateEmployeeRows[0]) {
      await sql`rollback`;
      return null;
    }

    const branchRows = await sql`
      select id from branches
      where company_id = ${companyId}
        and deleted_at is null
        and status = 'active'
        and name = ${branchName}
      order by id
      limit 1
    `;
    const branchId = (branchRows[0] as { id: string } | undefined)?.id;
    if (!branchId) {
      await sql`rollback`;
      return null;
    }

    const departmentRows = await sql`
      select id from departments
      where company_id = ${companyId}
        and deleted_at is null
        and status = 'active'
        and name = ${departmentName}
      order by id
      limit 1
    `;
    const departmentId = (departmentRows[0] as { id: string } | undefined)?.id;
    if (!departmentId) {
      await sql`rollback`;
      return null;
    }

    let positionId: string | null = null;
    if (positionName) {
      const positionRows = await sql`
        select id from positions
        where company_id = ${companyId}
          and deleted_at is null
          and status = 'active'
          and name = ${positionName}
        order by id
        limit 1
      `;
      positionId = (positionRows[0] as { id: string } | undefined)?.id ?? null;
      if (!positionId) {
        await sql`rollback`;
        return null;
      }
    }

    await sql`
      update employees
      set branch_id = ${branchId},
          department_id = ${departmentId},
          position_id = ${positionId},
          employee_number = ${employeeNumber},
          hire_date = ${input.hireDate},
          updated_at = ${updatedAt}
      where id = ${before.employee_id}
        and company_id = ${companyId}
        and user_id = ${targetUserId}
    `;

    await sql`
      insert into audit_logs (id, company_id, actor_user_id, action, resource_type, resource_id, before_json, after_json, metadata_json, created_at)
      values (
        ${`audit_admin_user_org_${targetUserId}_${Date.now()}`},
        ${companyId},
        ${actorUserId},
        'admin.user.organization.update',
        'employee',
        ${before.employee_id},
        ${JSON.stringify({ departmentName: before.department_name, branchName: before.branch_name, positionName: before.position_name, employeeNumber: before.employee_number, hireDate: parseDateOnly(before.hire_date) })}::jsonb,
        ${JSON.stringify({ departmentName, branchName, positionName, employeeNumber, hireDate: input.hireDate })}::jsonb,
        ${JSON.stringify({ source: "web-admin", category: "employee", reason: input.reason, maskedFields: [] })}::jsonb,
        ${updatedAt}
      )
    `;

    await sql`commit`;

    const user = await getOperationalAdminUserById(env, companyId, targetUserId, permissionsForRole, highRiskPermissions);
    return user ? { user, updatedAt } : null;
  } catch (error) {
    await sql`rollback`.catch(() => undefined);
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalAdminUserRoles(
  env: PostgresEnv | undefined,
  companyId: string,
  actorUserId: string,
  targetUserId: string,
  nextRoleCodes: RoleCode[],
  reason: string,
  permissionsForRole: (roleCode: RoleCode) => Permission["code"][],
  highRiskPermissions: readonly Permission["code"][],
): Promise<{ user: AdminUserSummary; updatedAt: string } | null> {
  const sql = createOperationalSql(env);
  if (!sql) return null;

  const updatedAt = new Date().toISOString();
  const uniqueRoleCodes = [...new Set(nextRoleCodes)];

  try {
    await sql`begin`;

    const targetRows = await sql`
      select id from users
      where id = ${targetUserId}
        and company_id = ${companyId}
        and deleted_at is null
      for update
    `;
    if (!targetRows[0]) {
      await sql`rollback`;
      return null;
    }

    const beforeRows = await sql`
      select coalesce(json_agg(r.code order by r.code) filter (where r.code is not null), '[]'::json) as role_codes
      from user_roles ur
      join roles r on r.id = ur.role_id and r.company_id = ur.company_id
      where ur.company_id = ${companyId}
        and ur.user_id = ${targetUserId}
        and ur.status = 'active'
        and ur.deleted_at is null
        and r.status = 'active'
        and r.deleted_at is null
    `;
    const beforeRoleCodes = (beforeRows[0] as { role_codes: unknown } | undefined)?.role_codes ?? [];

    await sql`
      update user_roles
      set status = 'inactive',
          updated_at = ${updatedAt},
          deleted_at = coalesce(deleted_at, ${updatedAt})
      where company_id = ${companyId}
        and user_id = ${targetUserId}
        and status = 'active'
        and deleted_at is null
    `;

    for (const roleCode of uniqueRoleCodes) {
      const roleRows = await sql`
        select id from roles
        where code = ${roleCode}
          and company_id = ${companyId}
          and status = 'active'
          and deleted_at is null
        limit 1
      `;
      const roleId = (roleRows[0] as { id: string } | undefined)?.id;
      if (!roleId) {
        await sql`rollback`;
        return null;
      }

      await sql`
        insert into user_roles (id, company_id, user_id, role_id, assigned_by, status, created_at, updated_at)
        values (${`user_role_${targetUserId}_${roleCode}_${Date.now()}`}, ${companyId}, ${targetUserId}, ${roleId}, ${actorUserId}, 'active', ${updatedAt}, ${updatedAt})
        on conflict (company_id, user_id, role_id, branch_id) do update
        set status = 'active', assigned_by = ${actorUserId}, updated_at = ${updatedAt}, deleted_at = null
      `;
    }

    await sql`
      insert into audit_logs (id, company_id, actor_user_id, action, resource_type, resource_id, before_json, after_json, metadata_json, created_at)
      values (
        ${`audit_admin_user_roles_${targetUserId}_${Date.now()}`},
        ${companyId},
        ${actorUserId},
        'admin.user.roles.update',
        'role_assignment',
        ${targetUserId},
        ${JSON.stringify({ roleCodes: beforeRoleCodes })}::jsonb,
        ${JSON.stringify({ roleCodes: uniqueRoleCodes })}::jsonb,
        ${JSON.stringify({ source: "web-admin", category: "permission", reason, maskedFields: ["password_hash", "session_token_hash"] })}::jsonb,
        ${updatedAt}
      )
    `;

    await sql`commit`;

    const user = await getOperationalAdminUserById(env, companyId, targetUserId, permissionsForRole, highRiskPermissions);
    return user ? { user, updatedAt } : null;
  } catch (error) {
    await sql`rollback`.catch(() => undefined);
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}
