import type {
  ErpExpenseRequest,
  ErpExpenseRequestCreateRequest,
  ErpExpenseRequestUpdateRequest,
  ErpExpenseStatus,
} from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

const ERP_EXPENSE_SOURCE = "postgres" as const;

type ErpExpenseRow = {
  id: string;
  company_id: string;
  vendor_id: string | null;
  vendor_name: string | null;
  title: string;
  expense_category: string;
  department_id: string | null;
  branch_id: string | null;
  project_code: string | null;
  payment_method: ErpExpenseRequest["paymentMethod"];
  tax_type: ErpExpenseRequest["taxType"];
  supply_amount: string | number;
  tax_amount: string | number;
  total_amount: string | number;
  spent_at: string | Date;
  evidence_file_id: string | null;
  approval_document_id: string | null;
  status: ErpExpenseStatus;
  sync_status: ErpExpenseRequest["syncStatus"];
  external_provider: "external_erp" | "kyungrinara" | null;
  external_reference_id: string | null;
  last_synced_at: string | Date | null;
  memo: string | null;
  requested_by_user_id: string;
  requested_by_employee_id: string;
  created_at: string | Date;
  updated_at: string | Date;
};

function toIsoString(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toRequiredIsoString(value: string | Date) {
  return toIsoString(value) ?? new Date(0).toISOString();
}

function toIsoDate(value: string | Date) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function blankToNull(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}

function mapExpense(row: ErpExpenseRow): ErpExpenseRequest {
  return {
    id: row.id,
    companyId: row.company_id,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    title: row.title,
    expenseCategory: row.expense_category,
    departmentId: row.department_id,
    branchId: row.branch_id,
    projectCode: row.project_code,
    paymentMethod: row.payment_method,
    taxType: row.tax_type,
    supplyAmount: toNumber(row.supply_amount),
    taxAmount: toNumber(row.tax_amount),
    totalAmount: toNumber(row.total_amount),
    spentAt: toIsoDate(row.spent_at),
    evidenceFileId: row.evidence_file_id,
    approvalDocumentId: row.approval_document_id,
    status: row.status,
    syncStatus: row.sync_status,
    externalProvider: row.external_provider,
    externalReferenceId: row.external_reference_id,
    lastSyncedAt: toIsoString(row.last_synced_at),
    memo: row.memo,
    requestedByUserId: row.requested_by_user_id,
    requestedByEmployeeId: row.requested_by_employee_id,
    createdAt: toRequiredIsoString(row.created_at),
    updatedAt: toRequiredIsoString(row.updated_at),
  };
}

const expenseSelect = `
  select e.id, e.company_id, e.vendor_id, v.name as vendor_name, e.title, e.expense_category,
    e.department_id, e.branch_id, e.project_code, e.payment_method, e.tax_type,
    e.supply_amount, e.tax_amount, e.total_amount, e.spent_at, e.evidence_file_id,
    e.approval_document_id, e.status, e.sync_status, e.external_provider,
    e.external_reference_id, e.last_synced_at, e.memo, e.requested_by_user_id,
    e.requested_by_employee_id, e.created_at, e.updated_at
  from erp_expense_requests e
  left join erp_vendors v on v.id = e.vendor_id and v.company_id = e.company_id and v.deleted_at is null
`;

export async function listOperationalErpExpenses(env: PostgresEnv | undefined, companyId: string, status?: ErpExpenseStatus) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    if (status) {
      const rows = await sql.query(
        `${expenseSelect} where e.company_id = $1 and e.status = $2 and e.deleted_at is null order by e.updated_at desc, e.id`,
        [companyId, status],
      );
      return { items: rows.map((row) => mapExpense(row as ErpExpenseRow)), source: ERP_EXPENSE_SOURCE };
    }
    const rows = await sql.query(
      `${expenseSelect} where e.company_id = $1 and e.deleted_at is null order by e.updated_at desc, e.id`,
      [companyId],
    );
    return { items: rows.map((row) => mapExpense(row as ErpExpenseRow)), source: ERP_EXPENSE_SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function findOperationalErpExpense(env: PostgresEnv | undefined, companyId: string, expenseId: string) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql.query(
      `${expenseSelect} where e.company_id = $1 and e.id = $2 and e.deleted_at is null limit 1`,
      [companyId, expenseId],
    );
    const row = rows[0] as ErpExpenseRow | undefined;
    return { expense: row ? mapExpense(row) : null, source: ERP_EXPENSE_SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function createOperationalErpExpense(
  env: PostgresEnv | undefined,
  input: {
    id: string;
    companyId: string;
    requestedByUserId: string;
    requestedByEmployeeId: string;
    createdAt: string;
    data: ErpExpenseRequestCreateRequest;
  },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql`
      insert into erp_expense_requests (
        id, company_id, vendor_id, title, expense_category, department_id, branch_id,
        project_code, payment_method, tax_type, supply_amount, tax_amount, spent_at,
        evidence_file_id, approval_document_id, status, sync_status, memo,
        requested_by_user_id, requested_by_employee_id, created_at, updated_at
      ) values (
        ${input.id}, ${input.companyId}, ${blankToNull(input.data.vendorId)}, ${input.data.title.trim()},
        ${input.data.expenseCategory.trim()}, ${blankToNull(input.data.departmentId)}, ${blankToNull(input.data.branchId)},
        ${blankToNull(input.data.projectCode)}, ${input.data.paymentMethod}, ${input.data.taxType},
        ${input.data.supplyAmount}, ${input.data.taxAmount}, ${input.data.spentAt}::date,
        ${blankToNull(input.data.evidenceFileId)}, ${blankToNull(input.data.approvalDocumentId)}, ${"draft"},
        ${"not_connected"}, ${blankToNull(input.data.memo)}, ${input.requestedByUserId},
        ${input.requestedByEmployeeId}, ${input.createdAt}::timestamptz, ${input.createdAt}::timestamptz
      ) returning id
    `;
    if (!rows[0]) return null;
    return findOperationalErpExpense(env, input.companyId, input.id);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalErpExpenseStatus(
  env: PostgresEnv | undefined,
  input: { companyId: string; expenseId: string; status: ErpExpenseStatus; updatedAt: string },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql`
      update erp_expense_requests
      set status = ${input.status}, updated_at = ${input.updatedAt}::timestamptz
      where company_id = ${input.companyId} and id = ${input.expenseId} and deleted_at is null
      returning id
    `;
    if (!rows[0]) return { expense: null, source: ERP_EXPENSE_SOURCE };
    return findOperationalErpExpense(env, input.companyId, input.expenseId);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalErpExpense(
  env: PostgresEnv | undefined,
  input: { companyId: string; expenseId: string; updatedAt: string; data: ErpExpenseRequestUpdateRequest },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const existing = await findOperationalErpExpense(env, input.companyId, input.expenseId);
    if (!existing?.expense) return existing;
    const rows = await sql`
      update erp_expense_requests
      set vendor_id = ${input.data.vendorId === undefined ? existing.expense.vendorId : blankToNull(input.data.vendorId)},
          title = ${input.data.title?.trim() ?? existing.expense.title},
          expense_category = ${input.data.expenseCategory?.trim() ?? existing.expense.expenseCategory},
          department_id = ${input.data.departmentId === undefined ? existing.expense.departmentId : blankToNull(input.data.departmentId)},
          branch_id = ${input.data.branchId === undefined ? existing.expense.branchId : blankToNull(input.data.branchId)},
          project_code = ${input.data.projectCode === undefined ? existing.expense.projectCode : blankToNull(input.data.projectCode)},
          payment_method = ${input.data.paymentMethod ?? existing.expense.paymentMethod},
          tax_type = ${input.data.taxType ?? existing.expense.taxType},
          supply_amount = ${input.data.supplyAmount ?? existing.expense.supplyAmount},
          tax_amount = ${input.data.taxAmount ?? existing.expense.taxAmount},
          spent_at = ${(input.data.spentAt ?? existing.expense.spentAt)}::date,
          evidence_file_id = ${input.data.evidenceFileId === undefined ? existing.expense.evidenceFileId : blankToNull(input.data.evidenceFileId)},
          approval_document_id = ${input.data.approvalDocumentId === undefined ? existing.expense.approvalDocumentId : blankToNull(input.data.approvalDocumentId)},
          memo = ${input.data.memo === undefined ? existing.expense.memo : blankToNull(input.data.memo)},
          updated_at = ${input.updatedAt}::timestamptz
      where company_id = ${input.companyId} and id = ${input.expenseId} and deleted_at is null
      returning id
    `;
    if (!rows[0]) return { expense: null, source: ERP_EXPENSE_SOURCE };
    return findOperationalErpExpense(env, input.companyId, input.expenseId);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}
