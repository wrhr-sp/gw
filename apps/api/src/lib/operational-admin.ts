import type { AdminScope, AdminUserSummary, Permission, RoleCode } from "@gw/shared";
import { createOperationalSql, type PostgresEnv } from "./postgres";

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
