import type {
  ErpClosingPeriod,
  ErpClosingPeriodCreateRequest,
  ErpClosingPeriodStatus,
  ErpLedgerEntry,
  ErpLedgerSummary,
} from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

const SOURCE = "postgres" as const;

type LedgerLineRow = {
  id: string;
  company_id: string;
  journal_entry_id: string;
  entry_number: string;
  entry_date: string | Date;
  journal_status: ErpLedgerEntry["journalStatus"];
  source_type: ErpLedgerEntry["sourceType"];
  account_subject_id: string;
  account_code: string;
  account_name: string;
  account_type: ErpLedgerEntry["accountType"];
  description: string;
  counterparty_summary: string | null;
  debit_amount: string | number;
  credit_amount: string | number;
};

type ClosingPeriodRow = {
  id: string;
  company_id: string;
  period_start: string | Date;
  period_end: string | Date;
  status: ErpClosingPeriodStatus;
  locked_at: string | Date | null;
  closed_at: string | Date | null;
  memo: string | null;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string | Date;
  updated_at: string | Date;
};

function iso(value: string | Date | null) {
  if (value === null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

function dateOnly(value: string | Date) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function n(value: string | number) {
  return Number(value);
}

function blankToNull(value: string | null | undefined) {
  const v = value?.trim();
  return v ? v : null;
}

function mapClosingPeriod(row: ClosingPeriodRow): ErpClosingPeriod {
  return {
    id: row.id,
    companyId: row.company_id,
    periodStart: dateOnly(row.period_start),
    periodEnd: dateOnly(row.period_end),
    status: row.status,
    lockedAt: iso(row.locked_at),
    closedAt: iso(row.closed_at),
    memo: row.memo,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: iso(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: iso(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function mapLedgerRows(rows: LedgerLineRow[]) {
  const runningByAccount = new Map<string, number>();
  const items: ErpLedgerEntry[] = rows.map((row) => {
    const debit = n(row.debit_amount);
    const credit = n(row.credit_amount);
    const before = runningByAccount.get(row.account_subject_id) ?? 0;
    const nextBalance = before + debit - credit;
    runningByAccount.set(row.account_subject_id, nextBalance);
    return {
      id: row.id,
      companyId: row.company_id,
      journalEntryId: row.journal_entry_id,
      journalEntryNumber: row.entry_number,
      entryDate: dateOnly(row.entry_date),
      journalStatus: row.journal_status,
      sourceType: row.source_type,
      accountSubjectId: row.account_subject_id,
      accountCode: row.account_code,
      accountName: row.account_name,
      accountType: row.account_type,
      description: row.description,
      counterpartySummary: row.counterparty_summary,
      debitAmount: debit,
      creditAmount: credit,
      runningBalance: nextBalance,
    };
  });

  const uniqueEntryIds = new Set(rows.map((row) => row.journal_entry_id));
  const uniqueAccounts = new Set(rows.map((row) => row.account_subject_id));
  const postedEntryIds = new Set(rows.filter((row) => row.journal_status === "posted").map((row) => row.journal_entry_id));
  const summary: ErpLedgerSummary = {
    totalDebitAmount: items.reduce((sum, item) => sum + item.debitAmount, 0),
    totalCreditAmount: items.reduce((sum, item) => sum + item.creditAmount, 0),
    balance: items.reduce((sum, item) => sum + item.debitAmount - item.creditAmount, 0),
    accountCount: uniqueAccounts.size,
    entryCount: uniqueEntryIds.size,
    postedEntryCount: postedEntryIds.size,
  };

  return { items, summary };
}

const ledgerSelect = `
select
  l.id,
  e.company_id,
  e.id as journal_entry_id,
  e.entry_number,
  e.entry_date,
  e.status as journal_status,
  e.source_type,
  l.account_subject_id,
  a.code as account_code,
  a.name as account_name,
  a.type as account_type,
  e.title as description,
  (
    select string_agg(distinct concat(oa.code, ' ', oa.name), ' / ' order by concat(oa.code, ' ', oa.name))
    from erp_journal_entry_lines ol
    join erp_account_subjects oa on oa.id = ol.account_subject_id
    where ol.journal_entry_id = e.id and ol.id <> l.id
  ) as counterparty_summary,
  l.debit_amount,
  l.credit_amount
from erp_journal_entry_lines l
join erp_journal_entries e on e.id = l.journal_entry_id
join erp_account_subjects a on a.id = l.account_subject_id
`;

const closingSelect = `select id, company_id, period_start, period_end, status, locked_at, closed_at, memo, created_by_user_id, updated_by_user_id, created_at, updated_at from erp_closing_periods`;

export async function listOperationalErpLedgerEntries(
  env: PostgresEnv | undefined,
  companyId: string,
  filters: { accountSubjectId?: string; from?: string; to?: string; status?: ErpLedgerEntry["journalStatus"] } = {},
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;

  const conditions = ["e.company_id = $1", "e.deleted_at is null"];
  const params: unknown[] = [companyId];
  if (filters.accountSubjectId) {
    params.push(filters.accountSubjectId);
    conditions.push(`l.account_subject_id = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    conditions.push(`e.entry_date >= $${params.length}::date`);
  }
  if (filters.to) {
    params.push(filters.to);
    conditions.push(`e.entry_date <= $${params.length}::date`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`e.status = $${params.length}`);
  }

  try {
    const rows = await sql.query(
      `${ledgerSelect} where ${conditions.join(" and ")} order by a.code, e.entry_date, e.created_at, l.id limit 500`,
      params,
    );
    return { ...mapLedgerRows(rows as LedgerLineRow[]), source: SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function listOperationalErpClosingPeriods(env: PostgresEnv | undefined, companyId: string) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql.query(`${closingSelect} where company_id = $1 and deleted_at is null order by period_start desc limit 60`, [companyId]);
    return { items: (rows as ClosingPeriodRow[]).map(mapClosingPeriod), source: SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function findOperationalErpClosingPeriod(env: PostgresEnv | undefined, companyId: string, periodId: string) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql.query(`${closingSelect} where company_id = $1 and id = $2 and deleted_at is null limit 1`, [companyId, periodId]);
    const row = rows[0] as ClosingPeriodRow | undefined;
    return { closingPeriod: row ? mapClosingPeriod(row) : null, source: SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function createOperationalErpClosingPeriod(
  env: PostgresEnv | undefined,
  input: { id: string; companyId: string; actorUserId: string; createdAt: string; data: ErpClosingPeriodCreateRequest },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  const lockedAt = input.data.status === "locked" || input.data.status === "closed" ? input.createdAt : null;
  const closedAt = input.data.status === "closed" ? input.createdAt : null;
  try {
    await sql`
      insert into erp_closing_periods (id, company_id, period_start, period_end, status, locked_at, closed_at, memo, created_by_user_id, updated_by_user_id, created_at, updated_at)
      values (${input.id}, ${input.companyId}, ${input.data.periodStart}::date, ${input.data.periodEnd}::date, ${input.data.status}, ${lockedAt}::timestamptz, ${closedAt}::timestamptz, ${blankToNull(input.data.memo)}, ${input.actorUserId}, ${input.actorUserId}, ${input.createdAt}::timestamptz, ${input.createdAt}::timestamptz)
    `;
    return findOperationalErpClosingPeriod(env, input.companyId, input.id);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalErpClosingPeriodStatus(
  env: PostgresEnv | undefined,
  input: { companyId: string; periodId: string; actorUserId: string; status: ErpClosingPeriodStatus; updatedAt: string },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    await sql.query(
      `update erp_closing_periods
       set status = $1,
           locked_at = case when $1 in ('locked','closed') then $3::timestamptz when $1 = 'open' then null else locked_at end,
           closed_at = case when $1 = 'closed' then $3::timestamptz when $1 = 'open' then null else closed_at end,
           updated_by_user_id = $2,
           updated_at = $3::timestamptz
       where company_id = $4 and id = $5 and deleted_at is null`,
      [input.status, input.actorUserId, input.updatedAt, input.companyId, input.periodId],
    );
    return findOperationalErpClosingPeriod(env, input.companyId, input.periodId);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}
