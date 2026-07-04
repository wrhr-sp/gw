import type { ErpAccountSubject, ErpAccountSubjectCreateRequest, ErpJournalEntry, ErpJournalEntryCreateRequest, ErpJournalEntryStatus } from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

const SOURCE = "postgres" as const;

type AccountRow = { id:string; company_id:string; code:string; name:string; type:ErpAccountSubject["type"]; parent_id:string|null; status:ErpAccountSubject["status"]; memo:string|null; created_by_user_id:string; updated_by_user_id:string; created_at:string|Date; updated_at:string|Date };
type EntryRow = { id:string; company_id:string; entry_number:string; entry_date:string|Date; title:string; status:ErpJournalEntryStatus; source_type:ErpJournalEntry["sourceType"]; source_id:string|null; total_debit_amount:string|number; total_credit_amount:string|number; memo:string|null; created_by_user_id:string; updated_by_user_id:string; created_at:string|Date; updated_at:string|Date };
type LineRow = { id:string; journal_entry_id:string; account_subject_id:string; account_code:string|null; account_name:string|null; debit_amount:string|number; credit_amount:string|number; memo:string|null };

function iso(value:string|Date){ const d=value instanceof Date?value:new Date(value); return Number.isNaN(d.getTime())?new Date(0).toISOString():d.toISOString(); }
function dateOnly(value:string|Date){ return value instanceof Date ? value.toISOString().slice(0,10) : String(value).slice(0,10); }
function n(value:string|number){ return Number(value); }
function blankToNull(value:string|null|undefined){ const v=value?.trim(); return v?v:null; }
function mapAccount(row:AccountRow): ErpAccountSubject { return { id:row.id, companyId:row.company_id, code:row.code, name:row.name, type:row.type, parentId:row.parent_id, status:row.status, memo:row.memo, createdByUserId:row.created_by_user_id, updatedByUserId:row.updated_by_user_id, createdAt:iso(row.created_at), updatedAt:iso(row.updated_at) }; }
function mapLine(row:LineRow): ErpJournalEntry["lines"][number] { return { id:row.id, accountSubjectId:row.account_subject_id, accountCode:row.account_code, accountName:row.account_name, debitAmount:n(row.debit_amount), creditAmount:n(row.credit_amount), memo:row.memo }; }
function mapEntry(row:EntryRow, lines:LineRow[]): ErpJournalEntry { return { id:row.id, companyId:row.company_id, entryNumber:row.entry_number, entryDate:dateOnly(row.entry_date), title:row.title, status:row.status, sourceType:row.source_type, sourceId:row.source_id, totalDebitAmount:n(row.total_debit_amount), totalCreditAmount:n(row.total_credit_amount), memo:row.memo, createdByUserId:row.created_by_user_id, updatedByUserId:row.updated_by_user_id, createdAt:iso(row.created_at), updatedAt:iso(row.updated_at), lines:lines.map(mapLine) }; }

const accountSelect = `select id, company_id, code, name, type, parent_id, status, memo, created_by_user_id, updated_by_user_id, created_at, updated_at from erp_account_subjects`;
const entrySelect = `select id, company_id, entry_number, entry_date, title, status, source_type, source_id, total_debit_amount, total_credit_amount, memo, created_by_user_id, updated_by_user_id, created_at, updated_at from erp_journal_entries`;
const lineSelect = `select l.id, l.journal_entry_id, l.account_subject_id, a.code as account_code, a.name as account_name, l.debit_amount, l.credit_amount, l.memo from erp_journal_entry_lines l join erp_account_subjects a on a.id = l.account_subject_id`;

export async function listOperationalErpAccountSubjects(env:PostgresEnv|undefined, companyId:string){
  const sql=createOperationalSql(env); if(!sql) return null;
  try { const rows=await sql.query(`${accountSelect} where company_id = $1 and deleted_at is null order by code`, [companyId]); return { items: rows.map((r)=>mapAccount(r as AccountRow)), source: SOURCE }; }
  catch(error){ if(isOperationalSchemaDriftError(error)) return null; throw error; }
}

export async function createOperationalErpAccountSubject(env:PostgresEnv|undefined, input:{id:string; companyId:string; actorUserId:string; createdAt:string; data:ErpAccountSubjectCreateRequest}){
  const sql=createOperationalSql(env); if(!sql) return null;
  try {
    await sql`insert into erp_account_subjects (id, company_id, code, name, type, parent_id, memo, created_by_user_id, updated_by_user_id, created_at, updated_at) values (${input.id}, ${input.companyId}, ${input.data.code.trim()}, ${input.data.name.trim()}, ${input.data.type}, ${blankToNull(input.data.parentId)}, ${blankToNull(input.data.memo)}, ${input.actorUserId}, ${input.actorUserId}, ${input.createdAt}::timestamptz, ${input.createdAt}::timestamptz)`;
    const rows=await sql.query(`${accountSelect} where company_id = $1 and id = $2 and deleted_at is null limit 1`, [input.companyId, input.id]);
    const row=rows[0] as AccountRow|undefined; return row ? { accountSubject: mapAccount(row), source: SOURCE } : null;
  } catch(error){ if(isOperationalSchemaDriftError(error)) return null; throw error; }
}

export async function listOperationalErpJournalEntries(env:PostgresEnv|undefined, companyId:string){
  const sql=createOperationalSql(env); if(!sql) return null;
  try {
    const entries=await sql.query(`${entrySelect} where company_id = $1 and deleted_at is null order by entry_date desc, created_at desc limit 100`, [companyId]);
    const ids=entries.map((e)=>String((e as EntryRow).id));
    const lines = ids.length ? await sql.query(`${lineSelect} where l.journal_entry_id = any($1) order by l.created_at, l.id`, [ids]) : [];
    return { items: entries.map((e)=>mapEntry(e as EntryRow, (lines as LineRow[]).filter((l)=>l.journal_entry_id === (e as EntryRow).id))), source: SOURCE };
  } catch(error){ if(isOperationalSchemaDriftError(error)) return null; throw error; }
}

export async function findOperationalErpJournalEntry(env:PostgresEnv|undefined, companyId:string, journalEntryId:string){
  const sql=createOperationalSql(env); if(!sql) return null;
  try {
    const entries=await sql.query(`${entrySelect} where company_id = $1 and id = $2 and deleted_at is null limit 1`, [companyId, journalEntryId]);
    const entry=entries[0] as EntryRow|undefined; if(!entry) return { journalEntry: null, source: SOURCE };
    const lines=await sql.query(`${lineSelect} where l.journal_entry_id = $1 order by l.created_at, l.id`, [journalEntryId]);
    return { journalEntry: mapEntry(entry, lines as LineRow[]), source: SOURCE };
  } catch(error){ if(isOperationalSchemaDriftError(error)) return null; throw error; }
}

export async function createOperationalErpJournalEntry(env:PostgresEnv|undefined, input:{id:string; companyId:string; actorUserId:string; createdAt:string; data:ErpJournalEntryCreateRequest}){
  const sql=createOperationalSql(env); if(!sql) return null;
  const totalDebit=input.data.lines.reduce((sum,line)=>sum+Number(line.debitAmount ?? 0),0);
  const totalCredit=input.data.lines.reduce((sum,line)=>sum+Number(line.creditAmount ?? 0),0);
  if (totalDebit <= 0 || totalDebit !== totalCredit) throw new Error("JOURNAL_NOT_BALANCED");
  try {
    const entryNumber=`JE-${input.data.entryDate.replaceAll("-","")}-${input.id.slice(-8)}`;
    await sql`insert into erp_journal_entries (id, company_id, entry_number, entry_date, title, status, source_type, source_id, total_debit_amount, total_credit_amount, memo, created_by_user_id, updated_by_user_id, created_at, updated_at) values (${input.id}, ${input.companyId}, ${entryNumber}, ${input.data.entryDate}::date, ${input.data.title.trim()}, ${"draft"}, ${input.data.sourceType}, ${blankToNull(input.data.sourceId)}, ${totalDebit}, ${totalCredit}, ${blankToNull(input.data.memo)}, ${input.actorUserId}, ${input.actorUserId}, ${input.createdAt}::timestamptz, ${input.createdAt}::timestamptz)`;
    for (const line of input.data.lines) {
      await sql`insert into erp_journal_entry_lines (id, journal_entry_id, account_subject_id, debit_amount, credit_amount, memo) values (${`erp_journal_line_${crypto.randomUUID()}`}, ${input.id}, ${line.accountSubjectId}, ${Number(line.debitAmount ?? 0)}, ${Number(line.creditAmount ?? 0)}, ${blankToNull(line.memo)})`;
    }
    return findOperationalErpJournalEntry(env, input.companyId, input.id);
  } catch(error){ if(isOperationalSchemaDriftError(error)) return null; throw error; }
}

export async function updateOperationalErpJournalEntryStatus(env:PostgresEnv|undefined, input:{companyId:string; journalEntryId:string; actorUserId:string; status:ErpJournalEntryStatus; updatedAt:string}){
  const sql=createOperationalSql(env); if(!sql) return null;
  try { await sql`update erp_journal_entries set status=${input.status}, updated_by_user_id=${input.actorUserId}, updated_at=${input.updatedAt}::timestamptz where company_id=${input.companyId} and id=${input.journalEntryId} and deleted_at is null`; return findOperationalErpJournalEntry(env, input.companyId, input.journalEntryId); }
  catch(error){ if(isOperationalSchemaDriftError(error)) return null; throw error; }
}
