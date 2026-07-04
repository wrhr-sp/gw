"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import {
  appRoutes,
  erpTaxDocumentCreateRequestSchema,
  erpTaxDocumentListResponseSchema,
  erpTaxDocumentMutationResponseSchema,
  erpTaxReportPackageCreateRequestSchema,
  erpTaxReportPackageListResponseSchema,
  erpTaxReportPackageMutationResponseSchema,
  errorResponseSchema,
  type ErpTaxDocument,
  type ErpTaxReportPackage,
} from "@gw/shared";
import { FeaturePageOverflowMenu } from "../../../_components/feature-page-overflow-menu";
import { FormField, FormGrid, FormSubmitButton, SelectInput, TextArea, TextInput } from "../../../_components/form-controls";
import { PageShell, Pill } from "../../../_components/page-shell";

type Toast = { tone: "accent" | "warning"; title: string; body: string } | null;
type DocumentType = ErpTaxDocument["documentType"];
type DocumentStatus = ErpTaxDocument["status"];
type PackageStatus = ErpTaxReportPackage["status"];

const docTypeLabel: Record<DocumentType, string> = { sales_tax_invoice: "매출세금계산서", purchase_tax_invoice: "매입세금계산서", cash_receipt: "현금영수증", vat_adjustment: "부가세조정" };
const docStatusLabel: Record<DocumentStatus, string> = { draft: "작성", matched: "매칭", review_required: "검토필요", reported: "신고반영", archived: "보관" };
const packageStatusLabel: Record<PackageStatus, string> = { draft: "작성", locked: "잠금", exported: "내보냄" };
const amount = (value: number) => new Intl.NumberFormat("ko-KR").format(value);

async function readError(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);
  return parsed.success ? parsed.data.error.message : `${response.status} ${response.statusText}`;
}

async function fetchTaxDocuments() {
  const response = await fetch(appRoutes.erp.taxDocuments, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response));
  return erpTaxDocumentListResponseSchema.parse(await response.json()).data.items;
}
async function fetchTaxReportPackages() {
  const response = await fetch(appRoutes.erp.taxReportPackages, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response));
  return erpTaxReportPackageListResponseSchema.parse(await response.json()).data.items;
}

function monthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { periodStart: start.toISOString().slice(0, 10), periodEnd: end.toISOString().slice(0, 10), issueDate: now.toISOString().slice(0, 10) };
}

export default function TaxesPage() {
  const defaults = useMemo(() => monthRange(), []);
  const [documents, setDocuments] = useState<ErpTaxDocument[]>([]);
  const [packages, setPackages] = useState<ErpTaxReportPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingDocument, setSubmittingDocument] = useState(false);
  const [submittingPackage, setSubmittingPackage] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [documentForm, setDocumentForm] = useState({ documentType: "sales_tax_invoice" as DocumentType, issueDate: defaults.issueDate, vendorName: "", businessRegistrationNumber: "", supplyAmount: "0", taxAmount: "0", status: "draft" as DocumentStatus, memo: "" });
  const [packageForm, setPackageForm] = useState({ periodStart: defaults.periodStart, periodEnd: defaults.periodEnd, status: "draft" as PackageStatus, memo: "" });

  const totals = useMemo(() => documents.reduce((acc, item) => {
    if (item.documentType === "sales_tax_invoice" || item.documentType === "vat_adjustment") { acc.salesSupply += item.supplyAmount; acc.salesTax += item.taxAmount; }
    if (item.documentType === "purchase_tax_invoice" || item.documentType === "cash_receipt") { acc.purchaseSupply += item.supplyAmount; acc.purchaseTax += item.taxAmount; }
    return acc;
  }, { salesSupply: 0, salesTax: 0, purchaseSupply: 0, purchaseTax: 0 }), [documents]);

  async function reload() {
    setLoading(true);
    setToast(null);
    try {
      const [nextDocuments, nextPackages] = await Promise.all([fetchTaxDocuments(), fetchTaxReportPackages()]);
      setDocuments(nextDocuments);
      setPackages(nextPackages);
    } catch (error) {
      setToast({ tone: "warning", title: "세무/부가세 정보를 불러오지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    } finally {
      setLoading(false);
    }
  }

  async function createDocument(event: FormEvent) {
    event.preventDefault();
    setSubmittingDocument(true);
    try {
      const payload = erpTaxDocumentCreateRequestSchema.parse({
        documentType: documentForm.documentType,
        issueDate: documentForm.issueDate,
        vendorName: documentForm.vendorName,
        businessRegistrationNumber: documentForm.businessRegistrationNumber || undefined,
        supplyAmount: Number(documentForm.supplyAmount),
        taxAmount: Number(documentForm.taxAmount),
        status: documentForm.status,
        memo: documentForm.memo || undefined,
      });
      const response = await fetch(appRoutes.erp.taxDocuments, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(await readError(response));
      erpTaxDocumentMutationResponseSchema.parse(await response.json());
      setDocumentForm((current) => ({ ...current, vendorName: "", businessRegistrationNumber: "", supplyAmount: "0", taxAmount: "0", memo: "" }));
      await reload();
      setToast({ tone: "accent", title: "세무자료를 등록했습니다.", body: "저장 후 DB 목록을 다시 조회했습니다." });
    } catch (error) {
      setToast({ tone: "warning", title: "세무자료 등록 실패", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    } finally { setSubmittingDocument(false); }
  }

  async function createPackage(event: FormEvent) {
    event.preventDefault();
    setSubmittingPackage(true);
    try {
      const payload = erpTaxReportPackageCreateRequestSchema.parse({ periodStart: packageForm.periodStart, periodEnd: packageForm.periodEnd, status: packageForm.status, memo: packageForm.memo || undefined });
      const response = await fetch(appRoutes.erp.taxReportPackages, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(await readError(response));
      erpTaxReportPackageMutationResponseSchema.parse(await response.json());
      setPackageForm((current) => ({ ...current, memo: "" }));
      await reload();
      setToast({ tone: "accent", title: "신고자료 묶음을 만들었습니다.", body: "현재 세무자료 합계가 DB에 저장됐습니다." });
    } catch (error) {
      setToast({ tone: "warning", title: "신고자료 묶음 생성 실패", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    } finally { setSubmittingPackage(false); }
  }

  useEffect(() => { void reload(); }, []);

  return (
    <PageShell title="세무/부가세" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace" aria-label="세무 부가세">
        <aside className="feature-workspace__nav" aria-label="세무 메뉴">
          <div className="feature-workspace__nav-header"><h1><button className="page-shell__title-link page-shell__title-button" onClick={() => void reload()} type="button">세무/부가세</button></h1><FeaturePageOverflowMenu label="세무/부가세" /></div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="세무 메뉴">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button"><span>세무자료</span><strong>{documents.length}</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>신고묶음</span><strong>{packages.length}</strong></button>
            <a className="feature-workspace__tab" href="/management-support/erp/evidence"><span>증빙함</span><strong>이동</strong></a>
            <a className="feature-workspace__tab" href="/management-support/erp/ledgers"><span>원장/마감</span><strong>이동</strong></a>
          </div>
        </aside>
        <section className="feature-workspace__panel" aria-labelledby="taxes-heading">
          <div className="feature-workspace__panel-header"><div><h2 id="taxes-heading">세무자료 / 부가세 신고자료</h2><p>외부기관 전송 없이 내부 DB 기준으로 세금계산서·현금영수증·부가세 신고 묶음을 관리합니다.</p></div><p className="feature-workspace__permission-hint">홈택스/국세청 API는 아직 연결하지 않은 마지막 단계 항목입니다.</p></div>
          {toast ? <article className="info-card"><Pill tone={toast.tone}>확인</Pill><h3>{toast.title}</h3><p>{toast.body}</p></article> : null}
          <div className="feature-workspace__status-grid">
            <article className="feature-workspace__status feature-workspace__status--accent"><span>매출 부가세</span><strong>{amount(totals.salesTax)}원</strong><p>공급가 {amount(totals.salesSupply)}원</p></article>
            <article className="feature-workspace__status"><span>매입 부가세</span><strong>{amount(totals.purchaseTax)}원</strong><p>공급가 {amount(totals.purchaseSupply)}원</p></article>
            <article className="feature-workspace__status feature-workspace__status--warning"><span>외부연동</span><strong>미연결</strong><p>내부자료 단계</p></article>
          </div>

          <form className="feature-workspace__rows" onSubmit={createDocument} aria-label="세무자료 등록">
            <article className="feature-workspace__row"><div><strong>세무자료 등록</strong><span>사업자번호는 원문 저장 없이 hash로만 보관합니다.</span><FormGrid>
              <FormField label="자료구분"><SelectInput value={documentForm.documentType} onChange={(event) => setDocumentForm((current) => ({ ...current, documentType: event.target.value as DocumentType }))}>{Object.entries(docTypeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectInput></FormField>
              <FormField label="발행일"><TextInput type="date" value={documentForm.issueDate} onChange={(event) => setDocumentForm((current) => ({ ...current, issueDate: event.target.value }))} required /></FormField>
              <FormField label="거래처명"><TextInput value={documentForm.vendorName} onChange={(event) => setDocumentForm((current) => ({ ...current, vendorName: event.target.value }))} required /></FormField>
              <FormField label="사업자번호"><TextInput value={documentForm.businessRegistrationNumber} onChange={(event) => setDocumentForm((current) => ({ ...current, businessRegistrationNumber: event.target.value }))} /></FormField>
              <FormField label="공급가"><TextInput type="number" value={documentForm.supplyAmount} onChange={(event) => setDocumentForm((current) => ({ ...current, supplyAmount: event.target.value }))} required /></FormField>
              <FormField label="세액"><TextInput type="number" value={documentForm.taxAmount} onChange={(event) => setDocumentForm((current) => ({ ...current, taxAmount: event.target.value }))} required /></FormField>
              <FormField label="상태"><SelectInput value={documentForm.status} onChange={(event) => setDocumentForm((current) => ({ ...current, status: event.target.value as DocumentStatus }))}>{Object.entries(docStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectInput></FormField>
              <FormField label="메모"><TextArea value={documentForm.memo} onChange={(event) => setDocumentForm((current) => ({ ...current, memo: event.target.value }))} /></FormField>
            </FormGrid></div><FormSubmitButton disabled={submittingDocument}>등록</FormSubmitButton></article>
          </form>

          <form className="feature-workspace__rows" onSubmit={createPackage} aria-label="신고자료 묶음 생성">
            <article className="feature-workspace__row"><div><strong>신고자료 묶음 생성</strong><span>기간 안의 세무자료를 합산해 내부 신고 준비 묶음으로 저장합니다.</span><FormGrid>
              <FormField label="시작일"><TextInput type="date" value={packageForm.periodStart} onChange={(event) => setPackageForm((current) => ({ ...current, periodStart: event.target.value }))} required /></FormField>
              <FormField label="종료일"><TextInput type="date" value={packageForm.periodEnd} onChange={(event) => setPackageForm((current) => ({ ...current, periodEnd: event.target.value }))} required /></FormField>
              <FormField label="상태"><SelectInput value={packageForm.status} onChange={(event) => setPackageForm((current) => ({ ...current, status: event.target.value as PackageStatus }))}>{Object.entries(packageStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectInput></FormField>
              <FormField label="메모"><TextArea value={packageForm.memo} onChange={(event) => setPackageForm((current) => ({ ...current, memo: event.target.value }))} /></FormField>
            </FormGrid></div><FormSubmitButton disabled={submittingPackage}>묶음 생성</FormSubmitButton></article>
          </form>

          <div className="feature-workspace__rows" aria-label="세무자료 목록">
            {loading ? <article className="feature-workspace__row"><div><strong>불러오는 중</strong><span>세무자료와 신고묶음을 조회하고 있습니다.</span></div><em>대기</em></article> : null}
            {!loading && documents.length === 0 ? <article className="feature-workspace__row"><div><strong>등록된 세무자료가 없습니다.</strong><span>세금계산서나 현금영수증 자료를 등록하면 목록에 표시됩니다.</span></div><em>빈 상태</em></article> : null}
            {documents.map((item) => <article className="feature-workspace__row" key={item.id}><div><strong>{docTypeLabel[item.documentType]} · {item.vendorName}</strong><span>{item.issueDate} · {docStatusLabel[item.status]} · 외부연동 {item.providerStatus === "not_connected" ? "미연결" : item.providerStatus}</span><p>공급가 {amount(item.supplyAmount)}원 · 세액 {amount(item.taxAmount)}원 · 합계 {amount(item.totalAmount)}원</p><p>{item.memo ?? "메모 없음"}</p></div><em>{amount(item.totalAmount)}원</em></article>)}
          </div>

          <div className="feature-workspace__rows" aria-label="신고자료 묶음 목록">
            {!loading && packages.length === 0 ? <article className="feature-workspace__row"><div><strong>생성된 신고자료 묶음이 없습니다.</strong><span>기간별 부가세 자료를 묶으면 이곳에 표시됩니다.</span></div><em>빈 상태</em></article> : null}
            {packages.map((item) => <article className="feature-workspace__row" key={item.id}><div><strong>{item.periodStart} ~ {item.periodEnd}</strong><span>{packageStatusLabel[item.status]} · 자료 {item.documentCount}건 · 외부연동 미연결</span><p>매출세액 {amount(item.salesTaxAmount)}원 · 매입세액 {amount(item.purchaseTaxAmount)}원</p><p>{item.memo ?? "메모 없음"}</p></div><em>{amount(item.salesTaxAmount - item.purchaseTaxAmount)}원</em></article>)}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
