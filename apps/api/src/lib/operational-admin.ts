import type { AdminAccountStatus, AdminAccountType, AdminAuditCategory, AdminAuditLog, AdminAuditMetadata, AdminAuditSource, AdminAuditTargetType, AdminScope, AdminUserCreateRequest, AdminUserOrganizationUpdateRequest, AdminUserProfileUpdateRequest, AdminUserReferenceMasterOption, AdminUserSecurityUpdateRequest, AdminUserSummary, DepartmentDuty, DepartmentDutyMutationRequest, EmployeeClassification, EmployeeOrganizationMaster, EmployeeOrganizationMasterKind, EmployeeOrganizationMasterMutationRequest, EmployeeSalaryInfo, OrganizationCodePolicy, OrganizationCodePolicyKind, OrganizationCodePolicyUpdateRequest, Permission, RoleCode } from "@gw/shared";
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
  return String(value).slice(0, 10);
}

function parseMoney(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseEmployeeClassification(value: unknown): EmployeeClassification {
  return value === "executive" || value === "ceo" ? value : "employee";
}

function parseSalaryInfo(row: Record<string, unknown>): EmployeeSalaryInfo | null {
  if (!row.salary_pay_type) return null;
  let rawFixedAllowances = row.salary_fixed_allowances_json;
  if (typeof rawFixedAllowances === "string") {
    try {
      rawFixedAllowances = JSON.parse(rawFixedAllowances || "[]");
    } catch {
      rawFixedAllowances = [];
    }
  }
  const fixedAllowances = Array.isArray(rawFixedAllowances) ? rawFixedAllowances : [];
  return {
    payType: row.salary_pay_type === "hourly" || row.salary_pay_type === "daily" || row.salary_pay_type === "annual" || row.salary_pay_type === "inclusive" ? row.salary_pay_type : "monthly",
    fixedAllowances: fixedAllowances
      .filter((item): item is { id?: unknown; label?: unknown; amount?: unknown } => Boolean(item) && typeof item === "object")
      .map((item) => ({ id: String(item.id ?? crypto.randomUUID()), label: String(item.label ?? "수당"), amount: parseMoney(item.amount) })),
    annualSalary: parseMoney(row.salary_annual_salary),
    monthlySalary: parseMoney(row.salary_monthly_salary),
    salaryBank: row.salary_bank === "shinhan" || row.salary_bank === "woori" || row.salary_bank === "hana" || row.salary_bank === "nh" || row.salary_bank === "ibk" || row.salary_bank === "kakao" || row.salary_bank === "toss" || row.salary_bank === "other" ? row.salary_bank : "kb",
    salaryAccountNumber: String(row.salary_account_number ?? ""),
    incomeTaxDependentCount: Number(row.salary_income_tax_dependent_count ?? 1),
    childTaxCreditCount: Number(row.salary_child_tax_credit_count ?? 0),
    durunuriEnabled: parseBoolean(row.salary_durunuri_enabled),
    durunuriPensionReductionRate: parseMoney(row.salary_durunuri_pension_reduction_rate),
    durunuriEmploymentReductionRate: parseMoney(row.salary_durunuri_employment_reduction_rate),
    smeIncomeTaxReductionEnabled: parseBoolean(row.salary_sme_income_tax_reduction_enabled),
    smeIncomeTaxReductionMode: row.salary_sme_income_tax_reduction_mode === "payroll" ? "payroll" : "year_end",
    smeIncomeTaxReductionRate: parseMoney(row.salary_sme_income_tax_reduction_rate),
    smeIncomeTaxReductionStartDate: parseDateOnly(row.salary_sme_income_tax_reduction_start_date) ?? undefined,
    smeIncomeTaxReductionEndDate: parseDateOnly(row.salary_sme_income_tax_reduction_end_date) ?? undefined,
  };
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
        coalesce(e.employee_classification, 'employee') as employee_classification,
        sp.pay_type as salary_pay_type,
        sp.fixed_allowances_json as salary_fixed_allowances_json,
        sp.annual_salary as salary_annual_salary,
        sp.monthly_salary as salary_monthly_salary,
        sp.salary_bank,
        sp.salary_account_number,
        sp.income_tax_dependent_count as salary_income_tax_dependent_count,
        sp.child_tax_credit_count as salary_child_tax_credit_count,
        sp.durunuri_enabled as salary_durunuri_enabled,
        sp.durunuri_pension_reduction_rate as salary_durunuri_pension_reduction_rate,
        sp.durunuri_employment_reduction_rate as salary_durunuri_employment_reduction_rate,
        sp.sme_income_tax_reduction_enabled as salary_sme_income_tax_reduction_enabled,
        sp.sme_income_tax_reduction_mode as salary_sme_income_tax_reduction_mode,
        sp.sme_income_tax_reduction_rate as salary_sme_income_tax_reduction_rate,
        sp.sme_income_tax_reduction_start_date as salary_sme_income_tax_reduction_start_date,
        sp.sme_income_tax_reduction_end_date as salary_sme_income_tax_reduction_end_date,
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
      left join lateral (
        select *
        from payroll_profiles pp
        where pp.company_id = e.company_id
          and pp.employee_id = e.id
          and pp.deleted_at is null
        order by pp.effective_from desc nulls last, pp.created_at desc
        limit 1
      ) sp on true
      left join user_security_settings uss on uss.user_id = u.id and uss.company_id = u.company_id
      left join auth_sessions s on s.user_id = u.id and s.company_id = u.company_id
      left join user_roles ur on ur.user_id = u.id and ur.company_id = u.company_id and ur.status = 'active'
      left join roles r on r.id = ur.role_id and r.company_id = ur.company_id and r.status = 'active'
      where u.company_id = ${companyId}
        and u.status in ('invited', 'active', 'locked', 'disabled', 'offboarded', 'suspended')
      group by u.id, u.company_id, e.id, e.full_name, u.display_name, u.email, d.name, b.name, p.name, e.employee_number, e.hire_date, e.employee_classification, sp.pay_type, sp.fixed_allowances_json, sp.annual_salary, sp.monthly_salary, sp.salary_bank, sp.salary_account_number, sp.income_tax_dependent_count, sp.child_tax_credit_count, sp.durunuri_enabled, sp.durunuri_pension_reduction_rate, sp.durunuri_employment_reduction_rate, sp.sme_income_tax_reduction_enabled, sp.sme_income_tax_reduction_mode, sp.sme_income_tax_reduction_rate, sp.sme_income_tax_reduction_start_date, sp.sme_income_tax_reduction_end_date, e.employment_status, u.status, u.must_change_password, u.last_login_at, uss.secondary_password_hash, uss.two_factor_required, uss.failed_login_count
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
      employee_classification: unknown;
      salary_pay_type: unknown;
      salary_fixed_allowances_json: unknown;
      salary_annual_salary: unknown;
      salary_monthly_salary: unknown;
      salary_bank: unknown;
      salary_account_number: unknown;
      salary_income_tax_dependent_count: unknown;
      salary_child_tax_credit_count: unknown;
      salary_durunuri_enabled: unknown;
      salary_durunuri_pension_reduction_rate: unknown;
      salary_durunuri_employment_reduction_rate: unknown;
      salary_sme_income_tax_reduction_enabled: unknown;
      salary_sme_income_tax_reduction_mode: unknown;
      salary_sme_income_tax_reduction_rate: unknown;
      salary_sme_income_tax_reduction_start_date: unknown;
      salary_sme_income_tax_reduction_end_date: unknown;
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
      employeeClassification: parseEmployeeClassification(typed.employee_classification),
      salaryInfo: parseSalaryInfo(typed as unknown as Record<string, unknown>),
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
  branches: AdminUserReferenceMasterOption[];
  departments: AdminUserReferenceMasterOption[];
  jobTitles: AdminUserReferenceMasterOption[];
  jobPositions: AdminUserReferenceMasterOption[];
  jobGrades: AdminUserReferenceMasterOption[];
} | null> {
  const sql = createOperationalSql(env);
  if (!sql) return null;

  try {
    const [groups, branches, departments, jobTitles, jobPositions, jobGrades] = await Promise.all([
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
        from branches
        where company_id = ${companyId}
          and status = 'active'
          and deleted_at is null
        order by name, code
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
      branches: mapReferenceMasterRows(branches),
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


function mapOrganizationMasterRows(kind: EmployeeOrganizationMasterKind, rows: unknown[]): EmployeeOrganizationMaster[] {
  return rows.map((row) => {
    const typed = row as {
      id: string;
      code: string;
      name: string;
      description: string | null;
      sort_order: unknown;
      parent_id: string | null;
      branch_id: string | null;
      is_active: unknown;
      linked_employee_count: unknown;
      updated_at: unknown;
    };
    return {
      kind,
      id: typed.id,
      code: typed.code,
      name: typed.name,
      description: typed.description ?? null,
      sortOrder: Number(typed.sort_order ?? 0),
      parentId: typed.parent_id ?? null,
      branchId: typed.branch_id ?? null,
      isActive: parseBoolean(typed.is_active),
      linkedEmployeeCount: parseCount(typed.linked_employee_count),
      updatedAt: parseDateTime(typed.updated_at),
    };
  });
}

function mapDepartmentDutyRows(rows: unknown[]): DepartmentDuty[] {
  return rows.map((row) => {
    const typed = row as {
      id: string;
      company_id: string;
      department_id: string;
      code: string;
      name: string;
      description: string | null;
      sort_order: unknown;
      is_active: unknown;
      linked_employee_count: unknown;
      updated_at: unknown;
    };
    return {
      id: typed.id,
      companyId: typed.company_id,
      departmentId: typed.department_id,
      code: typed.code,
      name: typed.name,
      description: typed.description ?? null,
      sortOrder: Number(typed.sort_order ?? 0),
      isActive: parseBoolean(typed.is_active),
      linkedEmployeeCount: parseCount(typed.linked_employee_count),
      updatedAt: parseDateTime(typed.updated_at),
    };
  });
}

async function recordAdminReferenceAudit(sql: ReturnType<typeof createOperationalSql>, input: {
  companyId: string;
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  before: unknown;
  after: unknown;
  reason: string;
  updatedAt: string;
}) {
  if (!sql) return;
  await sql`
    insert into audit_logs (id, company_id, actor_user_id, action, resource_type, resource_id, before_json, after_json, metadata_json, created_at)
    values (
      ${`audit_${input.action}_${input.resourceId}_${Date.now()}`},
      ${input.companyId},
      ${input.actorUserId},
      ${input.action},
      ${input.resourceType},
      ${input.resourceId},
      ${JSON.stringify(input.before)}::jsonb,
      ${JSON.stringify(input.after)}::jsonb,
      ${JSON.stringify({ source: "admin-employee-organization-masters", reason: input.reason })}::jsonb,
      ${input.updatedAt}
    )
  `;
}

export async function listOperationalEmployeeOrganizationMasters(env: PostgresEnv | undefined, companyId: string): Promise<Record<EmployeeOrganizationMasterKind, EmployeeOrganizationMaster[]> | null> {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const [branches, departments, jobGrades, jobPositions, jobTitles, groups] = await Promise.all([
      sql`select b.id, b.code, b.name, b.description, b.sort_order, null::text as parent_id, null::text as branch_id, (b.status = 'active') as is_active, count(e.id)::integer as linked_employee_count, b.updated_at from branches b left join employees e on e.branch_id = b.id and e.company_id = b.company_id and e.deleted_at is null where b.company_id = ${companyId} and b.deleted_at is null group by b.id order by b.sort_order, b.name, b.code`,
      sql`select d.id, d.code, d.name, d.description, d.sort_order, d.parent_department_id as parent_id, d.branch_id, (d.status = 'active') as is_active, count(e.id)::integer as linked_employee_count, d.updated_at from departments d left join employees e on e.department_id = d.id and e.company_id = d.company_id and e.deleted_at is null where d.company_id = ${companyId} and d.deleted_at is null group by d.id order by d.sort_order, d.name, d.code`,
      sql`select g.id, g.code, g.name, g.description, g.sort_order, null::text as parent_id, null::text as branch_id, g.is_active, count(e.id)::integer as linked_employee_count, g.updated_at from employee_job_grades g left join employees e on e.job_grade_id = g.id and e.company_id = g.company_id and e.deleted_at is null where g.company_id = ${companyId} and g.deleted_at is null group by g.id order by g.sort_order, g.name, g.code`,
      sql`select p.id, p.code, p.name, p.description, p.sort_order, null::text as parent_id, null::text as branch_id, p.is_active, count(e.id)::integer as linked_employee_count, p.updated_at from employee_job_positions p left join employees e on e.job_position_id = p.id and e.company_id = p.company_id and e.deleted_at is null where p.company_id = ${companyId} and p.deleted_at is null group by p.id order by p.sort_order, p.name, p.code`,
      sql`select t.id, t.code, t.name, t.description, t.sort_order, null::text as parent_id, null::text as branch_id, t.is_active, count(e.id)::integer as linked_employee_count, t.updated_at from employee_job_titles t left join employees e on e.job_title_id = t.id and e.company_id = t.company_id and e.deleted_at is null where t.company_id = ${companyId} and t.deleted_at is null group by t.id order by t.sort_order, t.name, t.code`,
      sql`select g.id, g.code, g.name, g.description, g.sort_order, null::text as parent_id, null::text as branch_id, g.is_active, count(e.id)::integer as linked_employee_count, g.updated_at from employee_groups g left join employees e on e.group_id = g.id and e.company_id = g.company_id and e.deleted_at is null where g.company_id = ${companyId} and g.deleted_at is null group by g.id order by g.sort_order, g.name, g.code`,
    ]);
    return {
      branches: mapOrganizationMasterRows("branches", branches),
      departments: mapOrganizationMasterRows("departments", departments),
      jobGrades: mapOrganizationMasterRows("jobGrades", jobGrades),
      jobPositions: mapOrganizationMasterRows("jobPositions", jobPositions),
      jobTitles: mapOrganizationMasterRows("jobTitles", jobTitles),
      groups: mapOrganizationMasterRows("groups", groups),
    };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

async function readOperationalEmployeeOrganizationMaster(sql: ReturnType<typeof createOperationalSql>, companyId: string, kind: EmployeeOrganizationMasterKind, id: string): Promise<EmployeeOrganizationMaster | null> {
  if (!sql) return null;
  const rows = kind === "branches"
    ? await sql`select b.id, b.code, b.name, b.description, b.sort_order, null::text as parent_id, null::text as branch_id, (b.status = 'active') as is_active, count(e.id)::integer as linked_employee_count, b.updated_at from branches b left join employees e on e.branch_id = b.id and e.company_id = b.company_id and e.deleted_at is null where b.company_id = ${companyId} and b.id = ${id} and b.deleted_at is null group by b.id`
    : kind === "departments"
      ? await sql`select d.id, d.code, d.name, d.description, d.sort_order, d.parent_department_id as parent_id, d.branch_id, (d.status = 'active') as is_active, count(e.id)::integer as linked_employee_count, d.updated_at from departments d left join employees e on e.department_id = d.id and e.company_id = d.company_id and e.deleted_at is null where d.company_id = ${companyId} and d.id = ${id} and d.deleted_at is null group by d.id`
      : kind === "jobGrades"
        ? await sql`select g.id, g.code, g.name, g.description, g.sort_order, null::text as parent_id, null::text as branch_id, g.is_active, count(e.id)::integer as linked_employee_count, g.updated_at from employee_job_grades g left join employees e on e.job_grade_id = g.id and e.company_id = g.company_id and e.deleted_at is null where g.company_id = ${companyId} and g.id = ${id} and g.deleted_at is null group by g.id`
        : kind === "jobPositions"
          ? await sql`select p.id, p.code, p.name, p.description, p.sort_order, null::text as parent_id, null::text as branch_id, p.is_active, count(e.id)::integer as linked_employee_count, p.updated_at from employee_job_positions p left join employees e on e.job_position_id = p.id and e.company_id = p.company_id and e.deleted_at is null where p.company_id = ${companyId} and p.id = ${id} and p.deleted_at is null group by p.id`
          : kind === "jobTitles"
            ? await sql`select t.id, t.code, t.name, t.description, t.sort_order, null::text as parent_id, null::text as branch_id, t.is_active, count(e.id)::integer as linked_employee_count, t.updated_at from employee_job_titles t left join employees e on e.job_title_id = t.id and e.company_id = t.company_id and e.deleted_at is null where t.company_id = ${companyId} and t.id = ${id} and t.deleted_at is null group by t.id`
            : await sql`select g.id, g.code, g.name, g.description, g.sort_order, null::text as parent_id, null::text as branch_id, g.is_active, count(e.id)::integer as linked_employee_count, g.updated_at from employee_groups g left join employees e on e.group_id = g.id and e.company_id = g.company_id and e.deleted_at is null where g.company_id = ${companyId} and g.id = ${id} and g.deleted_at is null group by g.id`;
  return mapOrganizationMasterRows(kind, rows)[0] ?? null;
}


function formatOrganizationCode(policy: { prefix: string; number_digits: unknown; next_sequence: unknown; format_pattern: string }) {
  const seq = String(Number(policy.next_sequence ?? 1)).padStart(Number(policy.number_digits ?? 3), "0");
  return (policy.format_pattern || "{PREFIX}-{SEQ}").replaceAll("{PREFIX}", policy.prefix).replaceAll("{SEQ}", seq);
}

function mapOrganizationCodePolicyRows(rows: unknown[]): OrganizationCodePolicy[] {
  return rows.map((row) => {
    const typed = row as {
      id: string;
      company_id: string;
      target_kind: OrganizationCodePolicyKind;
      prefix: string;
      number_digits: unknown;
      next_sequence: unknown;
      format_pattern: string;
      auto_generate_enabled: unknown;
      manual_edit_allowed: unknown;
      reuse_retired_code_allowed: unknown;
      is_active: unknown;
      updated_at: unknown;
    };
    return {
      id: typed.id,
      companyId: typed.company_id,
      kind: typed.target_kind,
      prefix: typed.prefix,
      numberDigits: Number(typed.number_digits ?? 3),
      nextSequence: Number(typed.next_sequence ?? 1),
      formatPattern: typed.format_pattern || "{PREFIX}-{SEQ}",
      autoGenerateEnabled: parseBoolean(typed.auto_generate_enabled),
      manualEditAllowed: parseBoolean(typed.manual_edit_allowed),
      reuseRetiredCodeAllowed: parseBoolean(typed.reuse_retired_code_allowed),
      isActive: parseBoolean(typed.is_active),
      nextCode: formatOrganizationCode(typed),
      updatedAt: parseDateTime(typed.updated_at),
    };
  });
}

export async function listOperationalOrganizationCodePolicies(env: PostgresEnv | undefined, companyId: string): Promise<OrganizationCodePolicy[] | null> {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql`
      select id, company_id, target_kind, prefix, number_digits, next_sequence, format_pattern, auto_generate_enabled, manual_edit_allowed, reuse_retired_code_allowed, is_active, updated_at
      from organization_code_policies
      where company_id = ${companyId}
        and deleted_at is null
      order by case target_kind when 'branches' then 1 when 'departments' then 2 when 'jobGrades' then 3 when 'jobPositions' then 4 when 'jobTitles' then 5 when 'departmentDuties' then 6 when 'groups' then 7 else 99 end
    `;
    return mapOrganizationCodePolicyRows(rows);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

async function readOperationalOrganizationCodePolicy(sql: ReturnType<typeof createOperationalSql>, companyId: string, kind: OrganizationCodePolicyKind): Promise<OrganizationCodePolicy | null> {
  if (!sql) return null;
  const rows = await sql`
    select id, company_id, target_kind, prefix, number_digits, next_sequence, format_pattern, auto_generate_enabled, manual_edit_allowed, reuse_retired_code_allowed, is_active, updated_at
    from organization_code_policies
    where company_id = ${companyId}
      and target_kind = ${kind}
      and deleted_at is null
    limit 1
  `;
  return mapOrganizationCodePolicyRows(rows)[0] ?? null;
}

async function resolveOrganizationCode(sql: ReturnType<typeof createOperationalSql>, companyId: string, kind: OrganizationCodePolicyKind, inputCode: string | undefined | null): Promise<string | null> {
  const normalized = inputCode?.trim();
  const policy = await readOperationalOrganizationCodePolicy(sql, companyId, kind);
  if (normalized) {
    if (policy && policy.autoGenerateEnabled && !policy.manualEditAllowed) return null;
    return normalized;
  }
  if (!policy || !policy.autoGenerateEnabled || !policy.isActive) return null;
  return policy.nextCode;
}

async function advanceOrganizationCodeSequence(sql: ReturnType<typeof createOperationalSql>, companyId: string, kind: OrganizationCodePolicyKind, usedCode: string | undefined | null) {
  if (!sql || !usedCode) return;
  await sql`
    update organization_code_policies
    set next_sequence = next_sequence + 1,
        updated_at = now()
    where company_id = ${companyId}
      and target_kind = ${kind}
      and deleted_at is null
      and auto_generate_enabled = true
      and is_active = true
      and ${usedCode} = replace(replace(format_pattern, '{PREFIX}', prefix), '{SEQ}', lpad(next_sequence::text, number_digits, '0'))
  `;
}

export async function upsertOperationalOrganizationCodePolicy(env: PostgresEnv | undefined, companyId: string, actorUserId: string, kind: OrganizationCodePolicyKind, input: OrganizationCodePolicyUpdateRequest): Promise<{ item: OrganizationCodePolicy; updatedAt: string } | null> {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  const updatedAt = new Date().toISOString();
  const itemId = `organization_code_policy_${companyId}_${kind}`;
  try {
    await sql`begin`;
    const before = await readOperationalOrganizationCodePolicy(sql, companyId, kind);
    await sql`
      insert into organization_code_policies (id, company_id, target_kind, prefix, number_digits, next_sequence, format_pattern, auto_generate_enabled, manual_edit_allowed, reuse_retired_code_allowed, is_active, created_at, updated_at)
      values (${itemId}, ${companyId}, ${kind}, ${input.prefix}, ${input.numberDigits}, ${input.nextSequence}, ${input.formatPattern}, ${input.autoGenerateEnabled}, ${input.manualEditAllowed}, ${input.reuseRetiredCodeAllowed}, ${input.isActive}, ${updatedAt}, ${updatedAt})
      on conflict (company_id, target_kind) do update
      set prefix = excluded.prefix,
          number_digits = excluded.number_digits,
          next_sequence = excluded.next_sequence,
          format_pattern = excluded.format_pattern,
          auto_generate_enabled = excluded.auto_generate_enabled,
          manual_edit_allowed = excluded.manual_edit_allowed,
          reuse_retired_code_allowed = excluded.reuse_retired_code_allowed,
          is_active = excluded.is_active,
          updated_at = excluded.updated_at,
          deleted_at = null
    `;
    const item = await readOperationalOrganizationCodePolicy(sql, companyId, kind);
    if (!item) { await sql`rollback`; return null; }
    await recordAdminReferenceAudit(sql, { companyId, actorUserId, action: before ? "admin.organization_code_policy.update" : "admin.organization_code_policy.create", resourceType: "organization_code_policy", resourceId: item.id, before, after: item, reason: input.reason, updatedAt });
    await sql`commit`;
    return { item, updatedAt };
  } catch (error) {
    await sql`rollback`.catch(() => undefined);
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function upsertOperationalEmployeeOrganizationMaster(env: PostgresEnv | undefined, companyId: string, actorUserId: string, kind: EmployeeOrganizationMasterKind, id: string | null, input: EmployeeOrganizationMasterMutationRequest): Promise<{ item: EmployeeOrganizationMaster; updatedAt: string } | null> {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  const updatedAt = new Date().toISOString();
  const itemId = id ?? `${kind}_${(input.code?.trim() || input.name).trim().toLowerCase().replace(/[^a-z0-9가-힣]+/gi, "_")}_${crypto.randomUUID().slice(0, 8)}`;
  try {
    await sql`begin`;
    const code = id ? input.code?.trim() : await resolveOrganizationCode(sql, companyId, kind, input.code);
    if (!code) { await sql`rollback`; return null; }
    const before = id ? await readOperationalEmployeeOrganizationMaster(sql, companyId, kind, id) : null;
    if (kind === "branches") {
      await sql`insert into branches (id, company_id, code, name, branch_type, status, description, sort_order, created_at, updated_at) values (${itemId}, ${companyId}, ${code}, ${input.name}, 'office', ${input.isActive ? 'active' : 'inactive'}, ${input.description ?? null}, ${input.sortOrder}, ${updatedAt}, ${updatedAt}) on conflict (company_id, code) do update set name = excluded.name, status = excluded.status, description = excluded.description, sort_order = excluded.sort_order, updated_at = excluded.updated_at, deleted_at = null`;
    } else if (kind === "departments") {
      await sql`insert into departments (id, company_id, branch_id, parent_department_id, code, name, status, description, sort_order, created_at, updated_at) values (${itemId}, ${companyId}, ${input.branchId ?? null}, ${input.parentId ?? null}, ${code}, ${input.name}, ${input.isActive ? 'active' : 'inactive'}, ${input.description ?? null}, ${input.sortOrder}, ${updatedAt}, ${updatedAt}) on conflict (company_id, code) do update set branch_id = excluded.branch_id, parent_department_id = excluded.parent_department_id, name = excluded.name, status = excluded.status, description = excluded.description, sort_order = excluded.sort_order, updated_at = excluded.updated_at, deleted_at = null`;
    } else if (kind === "jobGrades") {
      await sql`insert into employee_job_grades (id, company_id, code, name, description, sort_order, is_active, created_at, updated_at) values (${itemId}, ${companyId}, ${code}, ${input.name}, ${input.description ?? null}, ${input.sortOrder}, ${input.isActive}, ${updatedAt}, ${updatedAt}) on conflict (company_id, code) do update set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order, is_active = excluded.is_active, updated_at = excluded.updated_at, deleted_at = null`;
    } else if (kind === "jobPositions") {
      await sql`insert into employee_job_positions (id, company_id, code, name, description, sort_order, is_active, created_at, updated_at) values (${itemId}, ${companyId}, ${code}, ${input.name}, ${input.description ?? null}, ${input.sortOrder}, ${input.isActive}, ${updatedAt}, ${updatedAt}) on conflict (company_id, code) do update set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order, is_active = excluded.is_active, updated_at = excluded.updated_at, deleted_at = null`;
    } else if (kind === "jobTitles") {
      await sql`insert into employee_job_titles (id, company_id, code, name, description, sort_order, is_active, created_at, updated_at) values (${itemId}, ${companyId}, ${code}, ${input.name}, ${input.description ?? null}, ${input.sortOrder}, ${input.isActive}, ${updatedAt}, ${updatedAt}) on conflict (company_id, code) do update set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order, is_active = excluded.is_active, updated_at = excluded.updated_at, deleted_at = null`;
    } else {
      await sql`insert into employee_groups (id, company_id, code, name, description, sort_order, is_active, created_at, updated_at) values (${itemId}, ${companyId}, ${code}, ${input.name}, ${input.description ?? null}, ${input.sortOrder}, ${input.isActive}, ${updatedAt}, ${updatedAt}) on conflict (company_id, code) do update set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order, is_active = excluded.is_active, updated_at = excluded.updated_at, deleted_at = null`;
    }
    const item = await readOperationalEmployeeOrganizationMaster(sql, companyId, kind, itemId) ?? (await listOperationalEmployeeOrganizationMasters(env, companyId))?.[kind].find((candidate) => candidate.code === code);
    if (!item) { await sql`rollback`; return null; }
    await advanceOrganizationCodeSequence(sql, companyId, kind, code);
    await recordAdminReferenceAudit(sql, { companyId, actorUserId, action: before ? "admin.employee_organization_master.update" : "admin.employee_organization_master.create", resourceType: kind, resourceId: item.id, before, after: item, reason: input.reason, updatedAt });
    await sql`commit`;
    return { item, updatedAt };
  } catch (error) {
    await sql`rollback`.catch(() => undefined);
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalEmployeeOrganizationMasterStatus(env: PostgresEnv | undefined, companyId: string, actorUserId: string, kind: EmployeeOrganizationMasterKind, id: string, isActive: boolean, reason: string): Promise<{ item: EmployeeOrganizationMaster; updatedAt: string } | null> {
  const current = await readOperationalEmployeeOrganizationMaster(createOperationalSql(env), companyId, kind, id);
  if (!current) return null;
  return upsertOperationalEmployeeOrganizationMaster(env, companyId, actorUserId, kind, id, { code: current.code, name: current.name, description: current.description ?? undefined, sortOrder: current.sortOrder, isActive, parentId: current.parentId ?? undefined, branchId: current.branchId ?? undefined, reason });
}

export async function listOperationalDepartmentDuties(env: PostgresEnv | undefined, companyId: string, departmentId: string): Promise<DepartmentDuty[] | null> {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql`select d.id, d.company_id, d.department_id, d.code, d.name, d.description, d.sort_order, d.is_active, count(ed.id)::integer as linked_employee_count, d.updated_at from department_duties d left join employee_department_duties ed on ed.department_duty_id = d.id and ed.company_id = d.company_id and ed.deleted_at is null where d.company_id = ${companyId} and d.department_id = ${departmentId} and d.deleted_at is null group by d.id order by d.sort_order, d.name, d.code`;
    return mapDepartmentDutyRows(rows);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

async function readOperationalDepartmentDuty(sql: ReturnType<typeof createOperationalSql>, companyId: string, dutyId: string): Promise<DepartmentDuty | null> {
  if (!sql) return null;
  const rows = await sql`select d.id, d.company_id, d.department_id, d.code, d.name, d.description, d.sort_order, d.is_active, count(ed.id)::integer as linked_employee_count, d.updated_at from department_duties d left join employee_department_duties ed on ed.department_duty_id = d.id and ed.company_id = d.company_id and ed.deleted_at is null where d.company_id = ${companyId} and d.id = ${dutyId} and d.deleted_at is null group by d.id`;
  return mapDepartmentDutyRows(rows)[0] ?? null;
}

export async function upsertOperationalDepartmentDuty(env: PostgresEnv | undefined, companyId: string, actorUserId: string, departmentId: string, dutyId: string | null, input: DepartmentDutyMutationRequest): Promise<{ item: DepartmentDuty; updatedAt: string } | null> {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  const updatedAt = new Date().toISOString();
  const itemId = dutyId ?? `department_duty_${(input.code?.trim() || input.name).toLowerCase().replace(/[^a-z0-9가-힣]+/gi, "_")}_${crypto.randomUUID().slice(0, 8)}`;
  try {
    await sql`begin`;
    const code = dutyId ? input.code?.trim() : await resolveOrganizationCode(sql, companyId, "departmentDuties", input.code);
    if (!code) { await sql`rollback`; return null; }
    const department = await sql`select id from departments where company_id = ${companyId} and id = ${departmentId} and deleted_at is null limit 1`;
    if (!department[0]) { await sql`rollback`; return null; }
    const before = dutyId ? await readOperationalDepartmentDuty(sql, companyId, dutyId) : null;
    await sql`insert into department_duties (id, company_id, department_id, code, name, description, sort_order, is_active, created_at, updated_at) values (${itemId}, ${companyId}, ${departmentId}, ${code}, ${input.name}, ${input.description ?? null}, ${input.sortOrder}, ${input.isActive}, ${updatedAt}, ${updatedAt}) on conflict (company_id, department_id, code) do update set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order, is_active = excluded.is_active, updated_at = excluded.updated_at, deleted_at = null`;
    const item = await readOperationalDepartmentDuty(sql, companyId, itemId) ?? (await listOperationalDepartmentDuties(env, companyId, departmentId))?.find((candidate) => candidate.code === code);
    if (!item) { await sql`rollback`; return null; }
    await advanceOrganizationCodeSequence(sql, companyId, "departmentDuties", code);
    await recordAdminReferenceAudit(sql, { companyId, actorUserId, action: before ? "admin.department_duty.update" : "admin.department_duty.create", resourceType: "department_duty", resourceId: item.id, before, after: item, reason: input.reason, updatedAt });
    await sql`commit`;
    return { item, updatedAt };
  } catch (error) {
    await sql`rollback`.catch(() => undefined);
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalDepartmentDutyStatus(env: PostgresEnv | undefined, companyId: string, actorUserId: string, departmentId: string, dutyId: string, isActive: boolean, reason: string): Promise<{ item: DepartmentDuty; updatedAt: string } | null> {
  const current = await readOperationalDepartmentDuty(createOperationalSql(env), companyId, dutyId);
  if (!current || current.departmentId !== departmentId) return null;
  return upsertOperationalDepartmentDuty(env, companyId, actorUserId, departmentId, dutyId, { code: current.code, name: current.name, description: current.description ?? undefined, sortOrder: current.sortOrder, isActive, reason });
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
  const recognizedHireDate = input.recognizedHireDate ?? null;
  const contactPhone = input.contactPhone?.trim() || null;
  const externalEmail = input.externalEmail?.trim().toLowerCase() || null;
  const addressPostalCode = input.addressPostalCode?.trim() || null;
  const addressBase = input.addressBase?.trim() || null;
  const addressDetail = input.addressDetail?.trim() || null;
  const employmentCategory = input.employmentCategory?.trim() || null;
  const employeeClassification = input.employeeClassification ?? "employee";
  const salaryInfo = input.salaryInfo ?? null;
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
      select id, name from branches
      where company_id = ${companyId}
        and deleted_at is null
        and status = 'active'
        and ${input.branchId ? sql`id = ${input.branchId}` : sql`name = ${input.branchName.trim()}`}
      order by id
      limit 1
    `;
    const branch = branchRows[0] as { id: string; name: string } | undefined;
    const branchId = branch?.id;
    if (!branchId) {
      await sql`rollback`;
      return null;
    }

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

    const departmentDutyIds = Array.from(new Set(input.departmentDutyIds ?? []));
    if (departmentDutyIds.length > 0) {
      const dutyRows = await sql`
        select id from department_duties
        where company_id = ${companyId}
          and department_id = ${departmentId}
          and is_active = true
          and deleted_at is null
          and id = any(${departmentDutyIds})
      `;
      if (dutyRows.length !== departmentDutyIds.length) {
        await sql`rollback`;
        return null;
      }
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
      insert into employees (id, company_id, branch_id, group_id, user_id, department_id, position_id, job_title_id, job_position_id, job_grade_id, employee_number, full_name, employment_status, hire_date, recognized_hire_date, contact_phone, external_email, address_postal_code, address_base, address_detail, employment_category, employee_classification, created_at, updated_at)
      values (${employeeId}, ${companyId}, ${branchId}, ${groupId}, ${userId}, ${departmentId}, ${positionId}, ${jobTitleId}, ${jobPositionId}, ${jobGradeId}, ${employeeNumber}, ${input.fullName.trim()}, ${input.status === "offboarded" ? "offboarded" : input.status === "suspended" ? "on_leave" : "active"}, ${hireDate}, ${recognizedHireDate}, ${contactPhone}, ${externalEmail}, ${addressPostalCode}, ${addressBase}, ${addressDetail}, ${employmentCategory}, ${employeeClassification}, ${updatedAt}, ${updatedAt})
    `;

    if (salaryInfo) {
      await sql`
        insert into payroll_profiles (
          id, company_id, employee_id, employee_name, branch_id, branch_label, pay_type,
          base_pay, hourly_rate, daily_rate, annual_salary, inclusive_allowance,
          monthly_salary, fixed_allowances_json, salary_bank, salary_account_number,
          income_tax_dependent_count, child_tax_credit_count,
          durunuri_enabled, durunuri_pension_reduction_rate, durunuri_employment_reduction_rate,
          sme_income_tax_reduction_enabled, sme_income_tax_reduction_mode, sme_income_tax_reduction_rate,
          sme_income_tax_reduction_start_date, sme_income_tax_reduction_end_date,
          standard_work_hours, pay_day, effective_from, effective_to, scope_note, created_at, updated_at
        )
        values (
          ${`payroll_profile_${employeeId}_${Date.now()}`}, ${companyId}, ${employeeId}, ${input.fullName.trim()}, ${branchId}, ${branch?.name ?? input.branchName}, ${salaryInfo.payType},
          ${salaryInfo.monthlySalary}, ${0}, ${0}, ${salaryInfo.annualSalary}, ${0},
          ${salaryInfo.monthlySalary}, ${JSON.stringify(salaryInfo.fixedAllowances)}::jsonb, ${salaryInfo.salaryBank}, ${salaryInfo.salaryAccountNumber},
          ${salaryInfo.incomeTaxDependentCount}, ${salaryInfo.childTaxCreditCount},
          ${salaryInfo.durunuriEnabled}, ${salaryInfo.durunuriPensionReductionRate}, ${salaryInfo.durunuriEmploymentReductionRate},
          ${salaryInfo.smeIncomeTaxReductionEnabled}, ${salaryInfo.smeIncomeTaxReductionMode}, ${salaryInfo.smeIncomeTaxReductionRate},
          ${salaryInfo.smeIncomeTaxReductionStartDate ?? null}, ${salaryInfo.smeIncomeTaxReductionEndDate ?? null},
          ${209}, ${25}, ${hireDate}, null, ${"사원정보관리 급여정보"}, ${updatedAt}, ${updatedAt}
        )
      `;
    }

    for (const [index, departmentDutyId] of departmentDutyIds.entries()) {
      await sql`
        insert into employee_department_duties (id, company_id, employee_id, department_id, department_duty_id, sort_order, is_primary, is_active, created_at, updated_at)
        values (${`employee_department_duty_${employeeId}_${departmentDutyId}`}, ${companyId}, ${employeeId}, ${departmentId}, ${departmentDutyId}, ${index + 1}, ${index === 0}, true, ${updatedAt}, ${updatedAt})
        on conflict (company_id, employee_id, department_duty_id) do update
        set sort_order = excluded.sort_order,
            is_primary = excluded.is_primary,
            is_active = true,
            updated_at = excluded.updated_at,
            deleted_at = null
      `;
    }

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
        ${JSON.stringify({ userId, employeeId, email: normalizedEmail, roleCode: input.roleCode, status: input.status, accountType: input.accountType, employeeClassification, groupLinked: Boolean(groupId), departmentLinked: Boolean(departmentId), jobTitleLinked: Boolean(jobTitleId), jobPositionLinked: Boolean(jobPositionId), jobGradeLinked: Boolean(jobGradeId), departmentDutyCount: departmentDutyIds.length, salaryLinked: Boolean(salaryInfo) })}::jsonb,
        ${JSON.stringify({ source: "web-admin", category: "user", reason: input.reason, maskedFields: ["password_hash", "session_token_hash", "invite_token", "salary_account_number"] })}::jsonb,
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
