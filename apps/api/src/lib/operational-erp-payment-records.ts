import type {
  ErpPaymentRecord,
  ErpPaymentRecordCreateRequest,
  ErpPaymentRecordUpdateRequest,
  ErpPaymentMatchStatus,
  ErpReceivableStatus,
} from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

const ERP_PAYMENT_RECORD_SOURCE = "postgres" as const;

type ErpPaymentRecordRow = {
  id: string;
  company_id: string;
  billing_id: string | null;
  billing_title: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  direction: ErpPaymentRecord["direction"];
  payment_method: ErpPaymentRecord["paymentMethod"];
  amount: string | number;
  expected_at: string | Date | null;
  occurred_at: string | Date | null;
  match_status: ErpPaymentMatchStatus;
  receivable_status: ErpReceivableStatus;
  bank_account_label: string | null;
  transaction_memo: string | null;
  sync_status: ErpPaymentRecord["syncStatus"];
  external_provider: "kyungrinara" | null;
  external_reference_id: string | null;
  last_synced_at: string | Date | null;
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

function blankToNull(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}

function mapPaymentRecord(row: ErpPaymentRecordRow): ErpPaymentRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    billingId: row.billing_id,
    billingTitle: row.billing_title,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    direction: row.direction,
    paymentMethod: row.payment_method,
    amount: toNumber(row.amount),
    expectedAt: toIsoDate(row.expected_at),
    occurredAt: toIsoDate(row.occurred_at),
    matchStatus: row.match_status,
    receivableStatus: row.receivable_status,
    bankAccountLabel: row.bank_account_label,
    transactionMemo: row.transaction_memo,
    syncStatus: row.sync_status,
    externalProvider: row.external_provider,
    externalReferenceId: row.external_reference_id,
    lastSyncedAt: toIsoString(row.last_synced_at),
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: toRequiredIsoString(row.created_at),
    updatedAt: toRequiredIsoString(row.updated_at),
  };
}

const paymentRecordSelect = `
  select p.id, p.company_id, p.billing_id, b.title as billing_title, p.vendor_id, v.name as vendor_name,
    p.direction, p.payment_method, p.amount, p.expected_at, p.occurred_at, p.match_status,
    p.receivable_status, p.bank_account_label, p.transaction_memo, p.sync_status,
    p.external_provider, p.external_reference_id, p.last_synced_at, p.created_by_user_id,
    p.updated_by_user_id, p.created_at, p.updated_at
  from erp_payment_records p
  left join erp_billings b on b.id = p.billing_id and b.company_id = p.company_id and b.deleted_at is null
  left join erp_vendors v on v.id = p.vendor_id and v.company_id = p.company_id and v.deleted_at is null
`;

export async function listOperationalErpPaymentRecords(env: PostgresEnv | undefined, companyId: string, receivableStatus?: ErpReceivableStatus) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    if (receivableStatus) {
      const rows = await sql.query(
        `${paymentRecordSelect} where p.company_id = $1 and p.receivable_status = $2 and p.deleted_at is null order by p.updated_at desc, p.id`,
        [companyId, receivableStatus],
      );
      return { items: rows.map((row) => mapPaymentRecord(row as ErpPaymentRecordRow)), source: ERP_PAYMENT_RECORD_SOURCE };
    }
    const rows = await sql.query(
      `${paymentRecordSelect} where p.company_id = $1 and p.deleted_at is null order by p.updated_at desc, p.id`,
      [companyId],
    );
    return { items: rows.map((row) => mapPaymentRecord(row as ErpPaymentRecordRow)), source: ERP_PAYMENT_RECORD_SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function findOperationalErpPaymentRecord(env: PostgresEnv | undefined, companyId: string, paymentRecordId: string) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql.query(
      `${paymentRecordSelect} where p.company_id = $1 and p.id = $2 and p.deleted_at is null limit 1`,
      [companyId, paymentRecordId],
    );
    const row = rows[0] as ErpPaymentRecordRow | undefined;
    return { paymentRecord: row ? mapPaymentRecord(row) : null, source: ERP_PAYMENT_RECORD_SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function createOperationalErpPaymentRecord(
  env: PostgresEnv | undefined,
  input: { id: string; companyId: string; actorUserId: string; createdAt: string; data: ErpPaymentRecordCreateRequest },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql`
      insert into erp_payment_records (
        id, company_id, billing_id, vendor_id, direction, payment_method, amount,
        expected_at, occurred_at, match_status, receivable_status, bank_account_label,
        transaction_memo, sync_status, created_by_user_id, updated_by_user_id, created_at, updated_at
      ) values (
        ${input.id}, ${input.companyId}, ${blankToNull(input.data.billingId)}, ${blankToNull(input.data.vendorId)},
        ${input.data.direction}, ${input.data.paymentMethod}, ${input.data.amount}, ${input.data.expectedAt ?? null}::date,
        ${input.data.occurredAt ?? null}::date, ${input.data.matchStatus}, ${input.data.receivableStatus},
        ${blankToNull(input.data.bankAccountLabel)}, ${blankToNull(input.data.transactionMemo)}, ${"not_connected"},
        ${input.actorUserId}, ${input.actorUserId}, ${input.createdAt}::timestamptz, ${input.createdAt}::timestamptz
      ) returning id
    `;
    if (!rows[0]) return null;
    return findOperationalErpPaymentRecord(env, input.companyId, input.id);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalErpPaymentRecordStatus(
  env: PostgresEnv | undefined,
  input: {
    companyId: string;
    paymentRecordId: string;
    actorUserId: string;
    matchStatus: ErpPaymentMatchStatus;
    receivableStatus: ErpReceivableStatus;
    updatedAt: string;
  },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql`
      update erp_payment_records
      set match_status = ${input.matchStatus}, receivable_status = ${input.receivableStatus},
          updated_by_user_id = ${input.actorUserId}, updated_at = ${input.updatedAt}::timestamptz
      where company_id = ${input.companyId} and id = ${input.paymentRecordId} and deleted_at is null
      returning id
    `;
    if (!rows[0]) return { paymentRecord: null, source: ERP_PAYMENT_RECORD_SOURCE };
    return findOperationalErpPaymentRecord(env, input.companyId, input.paymentRecordId);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalErpPaymentRecord(
  env: PostgresEnv | undefined,
  input: { companyId: string; paymentRecordId: string; actorUserId: string; updatedAt: string; data: ErpPaymentRecordUpdateRequest },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const existing = await findOperationalErpPaymentRecord(env, input.companyId, input.paymentRecordId);
    if (!existing?.paymentRecord) return existing;
    const rows = await sql`
      update erp_payment_records
      set billing_id = ${input.data.billingId === undefined ? existing.paymentRecord.billingId : blankToNull(input.data.billingId)},
          vendor_id = ${input.data.vendorId === undefined ? existing.paymentRecord.vendorId : blankToNull(input.data.vendorId)},
          direction = ${input.data.direction ?? existing.paymentRecord.direction},
          payment_method = ${input.data.paymentMethod ?? existing.paymentRecord.paymentMethod},
          amount = ${input.data.amount ?? existing.paymentRecord.amount},
          expected_at = ${(input.data.expectedAt ?? existing.paymentRecord.expectedAt)}::date,
          occurred_at = ${(input.data.occurredAt ?? existing.paymentRecord.occurredAt)}::date,
          match_status = ${input.data.matchStatus ?? existing.paymentRecord.matchStatus},
          receivable_status = ${input.data.receivableStatus ?? existing.paymentRecord.receivableStatus},
          bank_account_label = ${input.data.bankAccountLabel === undefined ? existing.paymentRecord.bankAccountLabel : blankToNull(input.data.bankAccountLabel)},
          transaction_memo = ${input.data.transactionMemo === undefined ? existing.paymentRecord.transactionMemo : blankToNull(input.data.transactionMemo)},
          updated_by_user_id = ${input.actorUserId}, updated_at = ${input.updatedAt}::timestamptz
      where company_id = ${input.companyId} and id = ${input.paymentRecordId} and deleted_at is null
      returning id
    `;
    if (!rows[0]) return { paymentRecord: null, source: ERP_PAYMENT_RECORD_SOURCE };
    return findOperationalErpPaymentRecord(env, input.companyId, input.paymentRecordId);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}
