import { permissionCodeSchema, type BranchSummary, type Department, type Employee, type HomeShortcut, type Permission, type Role, type RoleCode } from "@gw/shared";
import { createOperationalSql, type PostgresEnv } from "./postgres";

const roleCodes = new Set<RoleCode>(["SUPER_ADMIN", "COMPANY_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE", "AUDITOR"]);
const roleScopes = new Set<Role["scope"]>(["global", "company", "audit"]);

type OperationalCompany = {
  id: string;
  name: string;
  status: "active" | "inactive";
  branchNames: string[];
};

function parseRoleCode(value: unknown): RoleCode | null {
  return typeof value === "string" && roleCodes.has(value as RoleCode) ? (value as RoleCode) : null;
}

function parseRoleCodes(value: unknown): RoleCode[] {
  if (!Array.isArray(value)) {
    return ["EMPLOYEE"];
  }

  const parsed = value.map(parseRoleCode).filter((item): item is RoleCode => item !== null);
  return parsed.length > 0 ? parsed : ["EMPLOYEE"];
}

function parsePermissionCodes(value: unknown): Permission["code"][] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => permissionCodeSchema.safeParse(item))
    .filter((result): result is { success: true; data: Permission["code"] } => result.success)
    .map((result) => result.data);
}

function normalizeRoleScope(value: unknown): Role["scope"] {
  if (typeof value === "string" && roleScopes.has(value as Role["scope"])) {
    return value as Role["scope"];
  }

  return "company";
}

export type OperationalEmployeeDirectory = {
  employees: Employee[];
  departments: Department[];
  roleCodeByEmployeeId: Map<string, RoleCode>;
  roleCodes: RoleCode[];
};

export async function listOperationalCompanies(env: PostgresEnv | undefined, companyId?: string) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const rows = await sql`
    select
      c.id,
      c.name,
      c.status,
      coalesce(json_agg(distinct b.name) filter (where b.name is not null), '[]'::json) as branch_names
    from companies c
    left join branches b on b.company_id = c.id and b.deleted_at is null
    where (${companyId ?? null}::text is null or c.id = ${companyId ?? null})
      and c.deleted_at is null
    group by c.id, c.name, c.status
    order by c.name, c.id
  `;

  return rows.map((row) => {
    const typed = row as {
      id: string;
      name: string;
      status: OperationalCompany["status"];
      branch_names: unknown;
    };

    return {
      id: typed.id,
      name: typed.name,
      status: typed.status,
      branchNames: Array.isArray(typed.branch_names)
        ? typed.branch_names.filter((item): item is string => typeof item === "string")
        : [],
    } satisfies OperationalCompany;
  });
}

export async function listOperationalBranches(env: PostgresEnv | undefined, companyId: string) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const rows = await sql`
    select id, company_id, code, name, branch_type, status
    from branches
    where company_id = ${companyId}
      and deleted_at is null
    order by code, name
  `;

  return rows.map((row) => {
    const typed = row as {
      id: string;
      company_id: string;
      code: string;
      name: string;
      branch_type: string;
      status: BranchSummary["status"];
    };

    return {
      id: typed.id,
      companyId: typed.company_id,
      code: typed.code,
      name: typed.name,
      branchType: typed.branch_type,
      status: typed.status,
    } satisfies BranchSummary;
  });
}

export async function findOperationalEmployeeBranchId(env: PostgresEnv | undefined, companyId: string, employeeId: string) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const rows = await sql`
    select branch_id
    from employees
    where company_id = ${companyId}
      and id = ${employeeId}
      and deleted_at is null
    limit 1
  `;

  const branchId = (rows[0] as { branch_id: string | null } | undefined)?.branch_id;
  return branchId ?? null;
}

export async function listOperationalEmployeeDirectory(env: PostgresEnv | undefined, companyId: string) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const [employeeRows, departmentRows] = await Promise.all([
    sql`
      select
        e.id,
        e.company_id,
        e.department_id,
        coalesce(u.email, 'unknown@example.com') as email,
        e.full_name,
        e.employment_status,
        coalesce(json_agg(distinct r.code) filter (where r.code is not null), '[]'::json) as role_codes
      from employees e
      join users u on u.id = e.user_id and u.company_id = e.company_id
      left join user_roles ur on ur.user_id = u.id and ur.company_id = u.company_id and ur.status = 'active'
      left join roles r on r.id = ur.role_id and r.company_id = ur.company_id and r.status = 'active'
      where e.company_id = ${companyId}
        and e.deleted_at is null
        and u.status = 'active'
      group by e.id, e.company_id, e.department_id, u.email, e.full_name, e.employment_status
      order by e.full_name, u.email
    `,
    sql`
      select id, company_id, parent_department_id, code, name, status
      from departments
      where company_id = ${companyId}
        and deleted_at is null
      order by code
    `,
  ]);

  const roleCodeByEmployeeId = new Map<string, RoleCode>();
  const roleCodeSet = new Set<RoleCode>();
  const employees = employeeRows.map((row) => {
    const typed = row as {
      id: string;
      company_id: string;
      department_id: string | null;
      email: string;
      full_name: string;
      employment_status: Employee["employmentStatus"];
      role_codes: unknown;
    };
    const roleCodesForEmployee = parseRoleCodes(typed.role_codes);
    roleCodeByEmployeeId.set(typed.id, roleCodesForEmployee[0] ?? "EMPLOYEE");
    roleCodesForEmployee.forEach((roleCode) => roleCodeSet.add(roleCode));

    return {
      id: typed.id,
      companyId: typed.company_id,
      departmentId: typed.department_id ?? "department_unassigned",
      email: typed.email,
      fullName: typed.full_name,
      employmentStatus: typed.employment_status,
    } satisfies Employee;
  });

  const departments = departmentRows.map((row) => {
    const typed = row as {
      id: string;
      company_id: string;
      parent_department_id: string | null;
      code: string;
      name: string;
      status: Department["status"];
    };

    return {
      id: typed.id,
      companyId: typed.company_id,
      parentDepartmentId: typed.parent_department_id,
      code: typed.code,
      name: typed.name,
      status: typed.status,
    } satisfies Department;
  });

  return {
    employees,
    departments,
    roleCodeByEmployeeId,
    roleCodes: [...roleCodeSet],
  } satisfies OperationalEmployeeDirectory;
}

export async function listOperationalDepartments(env: PostgresEnv | undefined, companyId: string) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const rows = await sql`
    select id, company_id, parent_department_id, code, name, status
    from departments
    where company_id = ${companyId}
      and deleted_at is null
    order by code
  `;

  return rows.map((row) => {
    const typed = row as {
      id: string;
      company_id: string;
      parent_department_id: string | null;
      code: string;
      name: string;
      status: Department["status"];
    };

    return {
      id: typed.id,
      companyId: typed.company_id,
      parentDepartmentId: typed.parent_department_id,
      code: typed.code,
      name: typed.name,
      status: typed.status,
    } satisfies Department;
  });
}

export async function listOperationalRoles(
  env: PostgresEnv | undefined,
  companyId: string,
  permissionsForRole: (roleCode: RoleCode) => Permission["code"][],
) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const rows = await sql`
    select
      r.code,
      r.name,
      r.role_scope,
      coalesce(json_agg(distinct p.code) filter (where p.code is not null), '[]'::json) as permission_codes
    from roles r
    left join role_permissions rp on rp.role_id = r.id
    left join permissions p on p.id = rp.permission_id
    where (r.company_id = ${companyId} or r.company_id is null)
      and r.status = 'active'
      and r.deleted_at is null
    group by r.id, r.code, r.name, r.role_scope
    order by r.code
  `;

  return rows
    .map((row) => {
      const typed = row as { code: string; name: string; role_scope: string; permission_codes: unknown };
      const roleCode = parseRoleCode(typed.code);
      if (!roleCode) {
        return null;
      }

      const permissionCodes = parsePermissionCodes(typed.permission_codes);

      return {
        code: roleCode,
        name: typed.name,
        scope: normalizeRoleScope(typed.role_scope),
        permissions: permissionCodes.length > 0 ? permissionCodes : permissionsForRole(roleCode),
      } satisfies Role;
    })
    .filter((item): item is Role => item !== null);
}

export async function listOperationalPermissions(
  env: PostgresEnv | undefined,
  defaultCatalog: readonly Permission[],
) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const defaultDescriptionByCode = new Map(defaultCatalog.map((permission) => [permission.code, permission.description]));
  const rows = await sql`
    select code, name
    from permissions
    order by permission_group, code
  `;

  const items = rows
    .map((row) => {
      const typed = row as { code: string; name: string };
      const description = defaultDescriptionByCode.get(typed.code as Permission["code"]);
      if (!description) {
        return null;
      }

      return {
        code: typed.code as Permission["code"],
        description,
      } satisfies Permission;
    })
    .filter((item): item is Permission => item !== null);

  return items.length > 0 ? items : [...defaultCatalog];
}

export async function listOperationalHomeShortcuts(
  env: PostgresEnv | undefined,
  companyId: string,
  userId: string,
) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const rows = await sql`
    select id, code, label, href, icon, is_fixed, sort_order, user_id
    from home_shortcuts
    where company_id = ${companyId}
      and status = 'active'
      and (user_id is null or user_id = ${userId})
    order by is_fixed desc, sort_order asc, label asc
  `;

  return rows.map((row) => {
    const typed = row as {
      id: string;
      code: string;
      label: string;
      href: string;
      icon: string | null;
      is_fixed: boolean;
      sort_order: number;
      user_id: string | null;
    };

    return {
      id: typed.id,
      code: typed.code,
      label: typed.label,
      href: typed.href,
      icon: typed.icon,
      isFixed: typed.is_fixed,
      sortOrder: typed.sort_order,
      scope: typed.user_id ? "user" : "company",
    } satisfies HomeShortcut;
  });
}
