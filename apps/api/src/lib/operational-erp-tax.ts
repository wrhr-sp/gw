import { createHash } from "node:crypto";
import type { ErpTaxDocument, ErpTaxDocumentCreateRequest, ErpTaxReportPackage, ErpTaxReportPackageCreateRequest } from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

const SOURCE = "postgres" as const;

type TaxDocumentRow = {
  id: string; company_id: string; document_type: ErpTaxDocument["documentType"]; issue_date: string|Date; vendor_name: string; business_registration_number_hash: string|null; supply_amount: string|number; tax_amount: string|number; total_amount: string|number; linked_evidence_id: string|null; linked_billing_id: string|null; linked_journal_entry_id: string|null; status: ErpTaxDocument["status"]; provider_status: "not_connected"; memo: string|null; created_by_user_id: string; updated_by_user_id: string; created_at: string|Date; updated_at: string|Date;
};
type TaxReportPackageRow = {
  id:string; company_id:string; period_start:string|Date; period_end:string|Date; status: ErpTaxReportPackage["status"]; sales_supply_amount:string|number; sales_tax_amount:string|number; purchase_supply_amount:string|number; purchase_tax_amount:string|number; document_count:string|number; provider_status:"not_connected"; memo:string|null; created_by_user_id:string; updated_by_user_id:string; created_at:string|Date; updated_at:string|Date;
};
type TaxSummaryRow = { sales_supply_amount:string|number|null; sales_tax_amount:string|number|null; purchase_supply_amount:string|number|null; purchase_tax_amount:string|number|null; document_count:string|number|null };

function iso(value:string|Date){ const d=value instanceof Date?value:new Date(value); return Number.isNaN(d.getTime())?new Date(0).toISOString():d.toISOString(); }
function dateOnly(value:string|Date){ return value instanceof Date ? value.toISOString().slice(0,10) : String(value).slice(0,10); }
function n(value:string|number|null|undefined){ return Number(value ?? 0); }
function blankToNull(value:string|null|undefined){ const v=value?.trim(); return v?v:null; }
function hashBusinessNumber(value:string|undefined){ const v=value?.replace(/[^0-9]/g, ""); return v ? `sha256:${createHash("sha256").update(v).digest("hex")}` : null; }

function mapTaxDocument(row:TaxDocumentRow): ErpTaxDocument {
  return { id:row.id, companyId:row.company_id, documentType:row.document_type, issueDate:dateOnly(row.issue_date), vendorName:row.vendor_name, businessRegistrationNumberHash:row.business_registration_number_hash, supplyAmount:n(row.supply_amount), taxAmount:n(row.tax_amount), totalAmount:n(row.total_amount), linkedEvidenceId:row.linked_evidence_id, linkedBillingId:row.linked_billing_id, linkedJournalEntryId:row.linked_journal_entry_id, status:row.status, providerStatus:row.provider_status, memo:row.memo, createdByUserId:row.created_by_user_id, updatedByUserId:row.updated_by_user_id, createdAt:iso(row.created_at), updatedAt:iso(row.updated_at) };
}
function mapTaxReportPackage(row:TaxReportPackageRow): ErpTaxReportPackage {
  return { id:row.id, companyId:row.company_id, periodStart:dateOnly(row.period_start), periodEnd:dateOnly(row.period_end), status:row.status, salesSupplyAmount:n(row.sales_supply_amount), salesTaxAmount:n(row.sales_tax_amount), purchaseSupplyAmount:n(row.purchase_supply_amount), purchaseTaxAmount:n(row.purchase_tax_amount), documentCount:n(row.document_count), providerStatus:row.provider_status, memo:row.memo, createdByUserId:row.created_by_user_id, updatedByUserId:row.updated_by_user_id, createdAt:iso(row.created_at), updatedAt:iso(row.updated_at) };
}

const taxDocumentSelect = `select id, company_id, document_type, issue_date, vendor_name, business_registration_number_hash, supply_amount, tax_amount, total_amount, linked_evidence_id, linked_billing_id, linked_journal_entry_id, status, provider_status, memo, created_by_user_id, updated_by_user_id, created_at, updated_at from erp_tax_documents`;
const taxReportSelect = `select id, company_id, period_start, period_end, status, sales_supply_amount, sales_tax_amount, purchase_supply_amount, purchase_tax_amount, document_count, provider_status, memo, created_by_user_id, updated_by_user_id, created_at, updated_at from erp_tax_report_packages`;

export async function listOperationalErpTaxDocuments(env:PostgresEnv|undefined, companyId:string){
  const sql=createOperationalSql(env); if(!sql) return null;
  try { const rows=await sql.query(`${taxDocumentSelect} where company_id = $1 and deleted_at is null order by issue_date desc, created_at desc limit 200`, [companyId]); return { items:(rows as TaxDocumentRow[]).map(mapTaxDocument), source:SOURCE }; }
  catch(error){ if(isOperationalSchemaDriftError(error)) return null; throw error; }
}

export async function createOperationalErpTaxDocument(env:PostgresEnv|undefined, input:{id:string; companyId:string; actorUserId:string; createdAt:string; data:ErpTaxDocumentCreateRequest}){
  const sql=createOperationalSql(env); if(!sql) return null;
  const total=Number(input.data.supplyAmount)+Number(input.data.taxAmount);
  try {
    await sql`insert into erp_tax_documents (id, company_id, document_type, issue_date, vendor_name, business_registration_number_hash, supply_amount, tax_amount, total_amount, linked_evidence_id, linked_billing_id, linked_journal_entry_id, status, memo, created_by_user_id, updated_by_user_id, created_at, updated_at) values (${input.id}, ${input.companyId}, ${input.data.documentType}, ${input.data.issueDate}::date, ${input.data.vendorName.trim()}, ${hashBusinessNumber(input.data.businessRegistrationNumber)}, ${Number(input.data.supplyAmount)}, ${Number(input.data.taxAmount)}, ${total}, ${blankToNull(input.data.linkedEvidenceId)}, ${blankToNull(input.data.linkedBillingId)}, ${blankToNull(input.data.linkedJournalEntryId)}, ${input.data.status}, ${blankToNull(input.data.memo)}, ${input.actorUserId}, ${input.actorUserId}, ${input.createdAt}::timestamptz, ${input.createdAt}::timestamptz)`;
    const rows=await sql.query(`${taxDocumentSelect} where company_id=$1 and id=$2 and deleted_at is null limit 1`, [input.companyId, input.id]);
    const row=rows[0] as TaxDocumentRow|undefined; return row ? { taxDocument:mapTaxDocument(row), source:SOURCE } : null;
  } catch(error){ if(isOperationalSchemaDriftError(error)) return null; throw error; }
}

export async function listOperationalErpTaxReportPackages(env:PostgresEnv|undefined, companyId:string){
  const sql=createOperationalSql(env); if(!sql) return null;
  try { const rows=await sql.query(`${taxReportSelect} where company_id=$1 and deleted_at is null order by period_start desc limit 60`, [companyId]); return { items:(rows as TaxReportPackageRow[]).map(mapTaxReportPackage), source:SOURCE }; }
  catch(error){ if(isOperationalSchemaDriftError(error)) return null; throw error; }
}

export async function createOperationalErpTaxReportPackage(env:PostgresEnv|undefined, input:{id:string; companyId:string; actorUserId:string; createdAt:string; data:ErpTaxReportPackageCreateRequest}){
  const sql=createOperationalSql(env); if(!sql) return null;
  try {
    const summaryRows=await sql.query(`select
      coalesce(sum(case when document_type in ('sales_tax_invoice','vat_adjustment') then supply_amount else 0 end),0) as sales_supply_amount,
      coalesce(sum(case when document_type in ('sales_tax_invoice','vat_adjustment') then tax_amount else 0 end),0) as sales_tax_amount,
      coalesce(sum(case when document_type in ('purchase_tax_invoice','cash_receipt') then supply_amount else 0 end),0) as purchase_supply_amount,
      coalesce(sum(case when document_type in ('purchase_tax_invoice','cash_receipt') then tax_amount else 0 end),0) as purchase_tax_amount,
      count(*) as document_count
      from erp_tax_documents where company_id=$1 and deleted_at is null and issue_date between $2::date and $3::date`, [input.companyId, input.data.periodStart, input.data.periodEnd]);
    const s=(summaryRows[0] ?? {}) as TaxSummaryRow;
    await sql`insert into erp_tax_report_packages (id, company_id, period_start, period_end, status, sales_supply_amount, sales_tax_amount, purchase_supply_amount, purchase_tax_amount, document_count, memo, created_by_user_id, updated_by_user_id, created_at, updated_at) values (${input.id}, ${input.companyId}, ${input.data.periodStart}::date, ${input.data.periodEnd}::date, ${input.data.status}, ${n(s.sales_supply_amount)}, ${n(s.sales_tax_amount)}, ${n(s.purchase_supply_amount)}, ${n(s.purchase_tax_amount)}, ${Math.trunc(n(s.document_count))}, ${blankToNull(input.data.memo)}, ${input.actorUserId}, ${input.actorUserId}, ${input.createdAt}::timestamptz, ${input.createdAt}::timestamptz)`;
    const rows=await sql.query(`${taxReportSelect} where company_id=$1 and id=$2 and deleted_at is null limit 1`, [input.companyId, input.id]);
    const row=rows[0] as TaxReportPackageRow|undefined; return row ? { taxReportPackage:mapTaxReportPackage(row), source:SOURCE } : null;
  } catch(error){ if(isOperationalSchemaDriftError(error)) return null; throw error; }
}
