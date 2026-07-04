import type { ErpBilling, ErpBillingCreateRequest, ErpBillingStatus, ErpBillingUpdateRequest } from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

const ERP_BILLING_SOURCE = "postgres" as const;

type ErpBillingRow = {
  id: string;
  company_id: string;
  vendor_id: string;
  vendor_name: string | null;
  contract_id: string | null;
  title: string;
  billing_category: string;
  department_id: string | null;
  branch_id: string | null;
  project_code: string | null;
  supply_amount: string | number;
  tax_amount: string | number;
  total_amount: string | number;
  billing_due_date: string | Date;
  payment_due_date: string | Date | null;
  issued_at: string | Date | null;
  paid_at: string | Date | null;
  status: ErpBillingStatus;
  payment_status: ErpBilling["paymentStatus"];
  tax_invoice_status: ErpBilling["taxInvoiceStatus"];
  sync_status: ErpBilling["syncStatus"];
  external_provider: "external_erp" | "kyungrinara" | null;
  external_reference_id: string | null;
  last_synced_at: string | Date | null;
  memo: string | null;
  created_by_user_id: string;
  updated_by_user_id: string;
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

function toIsoDate(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function toRequiredIsoDate(value: string | Date) {
  return toIsoDate(value) ?? "1970-01-01";
}

function blankToNull(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}

function mapBilling(row: ErpBillingRow): ErpBilling {
  return {
    id: row.id,
    companyId: row.company_id,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    contractId: row.contract_id,
    title: row.title,
    billingCategory: row.billing_category,
    departmentId: row.department_id,
    branchId: row.branch_id,
    projectCode: row.project_code,
    supplyAmount: toNumber(row.supply_amount),
    taxAmount: toNumber(row.tax_amount),
    totalAmount: toNumber(row.total_amount),
    billingDueDate: toRequiredIsoDate(row.billing_due_date),
    paymentDueDate: toIsoDate(row.payment_due_date),
    issuedAt: toIsoDate(row.issued_at),
    paidAt: toIsoDate(row.paid_at),
    status: row.status,
    paymentStatus: row.payment_status,
    taxInvoiceStatus: row.tax_invoice_status,
    syncStatus: row.sync_status,
    externalProvider: row.external_provider,
    externalReferenceId: row.external_reference_id,
    lastSyncedAt: toIsoString(row.last_synced_at),
    memo: row.memo,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: toRequiredIsoString(row.created_at),
    updatedAt: toRequiredIsoString(row.updated_at),
  };
}

const billingSelect = `
  select b.id, b.company_id, b.vendor_id, v.name as vendor_name, b.contract_id, b.title,
    b.billing_category, b.department_id, b.branch_id, b.project_code, b.supply_amount,
    b.tax_amount, b.total_amount, b.billing_due_date, b.payment_due_date, b.issued_at,
    b.paid_at, b.status, b.payment_status, b.tax_invoice_status, b.sync_status,
    b.external_provider, b.external_reference_id, b.last_synced_at, b.memo,
    b.created_by_user_id, b.updated_by_user_id, b.created_at, b.updated_at
  from erp_billings b
  left join erp_vendors v on v.id = b.vendor_id and v.company_id = b.company_id and v.deleted_at is null
`;

export async function listOperationalErpBillings(env: PostgresEnv | undefined, companyId: string, status?: ErpBillingStatus) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    if (status) {
      const rows = await sql.query(
        `${billingSelect} where b.company_id = $1 and b.status = $2 and b.deleted_at is null order by b.updated_at desc, b.id`,
        [companyId, status],
      );
      return { items: rows.map((row) => mapBilling(row as ErpBillingRow)), source: ERP_BILLING_SOURCE };
    }
    const rows = await sql.query(
      `${billingSelect} where b.company_id = $1 and b.deleted_at is null order by b.updated_at desc, b.id`,
      [companyId],
    );
    return { items: rows.map((row) => mapBilling(row as ErpBillingRow)), source: ERP_BILLING_SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function findOperationalErpBilling(env: PostgresEnv | undefined, companyId: string, billingId: string) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql.query(
      `${billingSelect} where b.company_id = $1 and b.id = $2 and b.deleted_at is null limit 1`,
      [companyId, billingId],
    );
    const row = rows[0] as ErpBillingRow | undefined;
    return { billing: row ? mapBilling(row) : null, source: ERP_BILLING_SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function createOperationalErpBilling(
  env: PostgresEnv | undefined,
  input: { id: string; companyId: string; actorUserId: string; createdAt: string; data: ErpBillingCreateRequest },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql`
      insert into erp_billings (
        id, company_id, vendor_id, contract_id, title, billing_category, department_id,
        branch_id, project_code, supply_amount, tax_amount, billing_due_date, payment_due_date,
        status, payment_status, tax_invoice_status, sync_status, memo, created_by_user_id,
        updated_by_user_id, created_at, updated_at
      ) values (
        ${input.id}, ${input.companyId}, ${input.data.vendorId}, ${blankToNull(input.data.contractId)},
        ${input.data.title.trim()}, ${input.data.billingCategory.trim()}, ${blankToNull(input.data.departmentId)},
        ${blankToNull(input.data.branchId)}, ${blankToNull(input.data.projectCode)}, ${input.data.supplyAmount},
        ${input.data.taxAmount}, ${input.data.billingDueDate}::date, ${input.data.paymentDueDate ?? null}::date,
        ${"draft"}, ${"not_due"}, ${"not_requested"}, ${"not_connected"}, ${blankToNull(input.data.memo)},
        ${input.actorUserId}, ${input.actorUserId}, ${input.createdAt}::timestamptz, ${input.createdAt}::timestamptz
      ) returning id
    `;
    if (!rows[0]) return null;
    return findOperationalErpBilling(env, input.companyId, input.id);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalErpBillingStatus(
  env: PostgresEnv | undefined,
  input: {
    companyId: string;
    billingId: string;
    actorUserId: string;
    status: ErpBillingStatus;
    paymentStatus?: ErpBilling["paymentStatus"];
    taxInvoiceStatus?: ErpBilling["taxInvoiceStatus"];
    updatedAt: string;
  },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const existing = await findOperationalErpBilling(env, input.companyId, input.billingId);
    if (!existing?.billing) return existing;
    const rows = await sql`
      update erp_billings
      set status = ${input.status},
          payment_status = ${input.paymentStatus ?? existing.billing.paymentStatus},
          tax_invoice_status = ${input.taxInvoiceStatus ?? existing.billing.taxInvoiceStatus},
          updated_by_user_id = ${input.actorUserId},
          updated_at = ${input.updatedAt}::timestamptz
      where company_id = ${input.companyId} and id = ${input.billingId} and deleted_at is null
      returning id
    `;
    if (!rows[0]) return { billing: null, source: ERP_BILLING_SOURCE };
    return findOperationalErpBilling(env, input.companyId, input.billingId);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalErpBilling(
  env: PostgresEnv | undefined,
  input: { companyId: string; billingId: string; actorUserId: string; updatedAt: string; data: ErpBillingUpdateRequest },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const existing = await findOperationalErpBilling(env, input.companyId, input.billingId);
    if (!existing?.billing) return existing;
    const rows = await sql`
      update erp_billings
      set vendor_id = ${input.data.vendorId ?? existing.billing.vendorId},
          contract_id = ${input.data.contractId === undefined ? existing.billing.contractId : blankToNull(input.data.contractId)},
          title = ${input.data.title?.trim() ?? existing.billing.title},
          billing_category = ${input.data.billingCategory?.trim() ?? existing.billing.billingCategory},
          department_id = ${input.data.departmentId === undefined ? existing.billing.departmentId : blankToNull(input.data.departmentId)},
          branch_id = ${input.data.branchId === undefined ? existing.billing.branchId : blankToNull(input.data.branchId)},
          project_code = ${input.data.projectCode === undefined ? existing.billing.projectCode : blankToNull(input.data.projectCode)},
          supply_amount = ${input.data.supplyAmount ?? existing.billing.supplyAmount},
          tax_amount = ${input.data.taxAmount ?? existing.billing.taxAmount},
          billing_due_date = ${(input.data.billingDueDate ?? existing.billing.billingDueDate)}::date,
          payment_due_date = ${(input.data.paymentDueDate ?? existing.billing.paymentDueDate)}::date,
          memo = ${input.data.memo === undefined ? existing.billing.memo : blankToNull(input.data.memo)},
          updated_by_user_id = ${input.actorUserId},
          updated_at = ${input.updatedAt}::timestamptz
      where company_id = ${input.companyId} and id = ${input.billingId} and deleted_at is null
      returning id
    `;
    if (!rows[0]) return { billing: null, source: ERP_BILLING_SOURCE };
    return findOperationalErpBilling(env, input.companyId, input.billingId);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}
