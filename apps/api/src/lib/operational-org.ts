import type { Department, Employee, Permission, Role, RoleCode } from "@gw/shared";
import { createOperationalSql, type PostgresEnv } from "./postgres";

const roleCodes = new Set<RoleCode>(["SUPER_ADMIN", "COMPANY_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE", "AUDITOR"]);
const roleScopes = new Set<Role["scope"]>(["global", "company", "audit"]);

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
    select code, name, role_scope
    from roles
    where (company_id = ${companyId} or company_id is null)
      and status = 'active'
      and deleted_at is null
    order by code
  `;

  return rows
    .map((row) => {
      const typed = row as { code: string; name: string; role_scope: string };
      const roleCode = parseRoleCode(typed.code);
      if (!roleCode) {
        return null;
      }

      return {
        code: roleCode,
        name: typed.name,
        scope: normalizeRoleScope(typed.role_scope),
        permissions: permissionsForRole(roleCode),
      } satisfies Role;
    })
    .filter((item): item is Role => item !== null);
}
