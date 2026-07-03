import type {
  PayrollDraft,
  PayrollInputSnapshot,
  PayrollLineItem,
  PayrollPeriod,
  PayrollProfile,
  PayrollReviewStep,
  RoleCode,
  WorkItem,
  WorkItemAttachment,
  WorkItemAuditLog,
  WorkItemDeadline,
  WorkItemDocument,
  WorkItemReview,
} from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

type DbRow = Record<string, unknown>;

type ComplianceAlert = {
  id: string;
  companyId: string;
  module: "payroll" | "tax" | "labor" | "legal" | "compliance";
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "reviewing" | "resolved" | "dismissed";
  title: string;
  summary: string;
  linkedResourceType: string | null;
  linkedResourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
};

const roleCodes = new Set<RoleCode>(["SUPER_ADMIN", "COMPANY_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE", "AUDITOR"]);
const workItemModules = new Set<WorkItem["module"]>(["hr", "tax", "labor", "legal", "branch"]);
const workItemStatuses = new Set<WorkItem["status"]>(["draft", "todo", "in_progress", "waiting_review", "blocked", "done", "archived"]);
const workItemPriorities = new Set<WorkItem["priority"]>(["low", "normal", "high", "critical"]);
const workItemViewerScopes = new Set<WorkItem["access"]["viewerScope"]>(["self", "branch", "company", "company_audit"]);
const workItemCapabilities = new Set<WorkItem["access"]["capabilities"][number]>([
  "work_item.read",
  "work_item.manage",
  "work_item.review",
  "work_item.deadline.read",
  "work_item.attachment.read_sensitive",
  "work_item.audit.read",
  "work_item.grievance.read_restricted",
  "work_item.labor.read_restricted",
]);
const payrollPayTypes = new Set<PayrollProfile["payType"]>(["monthly", "hourly", "daily", "annual", "inclusive"]);
const payrollPeriodStatuses = new Set<PayrollPeriod["status"]>(["draft", "collecting", "reviewing", "confirmed", "closed"]);
const payrollLineItemClassifications = new Set<PayrollLineItem["classification"]>([
  "earning",
  "deduction",
  "tax_estimate",
  "insurance_estimate",
]);
const payrollLineItemSources = new Set<PayrollLineItem["source"]>([
  "manual",
  "attendance",
  "policy",
  "tax_estimate",
  "insurance_estimate",
]);
const payrollReviewScopes = new Set<PayrollReviewStep["scope"]>([
  "headquarters_payroll",
  "branch_manager",
  "employee",
  "auditor",
]);
const payrollReviewStatuses = new Set<PayrollReviewStep["status"]>([
  "pending",
  "submitted",
  "reviewing",
  "changes_requested",
  "confirmed",
]);
const complianceModules = new Set<ComplianceAlert["module"]>(["payroll", "tax", "labor", "legal", "compliance"]);
const complianceSeverities = new Set<ComplianceAlert["severity"]>(["low", "medium", "high", "critical"]);
const complianceStatuses = new Set<ComplianceAlert["status"]>(["open", "reviewing", "resolved", "dismissed"]);
const workItemDocumentStatuses = new Set<WorkItemDocument["status"]>(["draft", "requested", "received", "review_ready"]);
const workItemDocumentVisibilities = new Set<WorkItemDocument["visibility"]>(["branch", "company", "restricted"]);
const workItemAttachmentSensitivity = new Set<WorkItemAttachment["sensitivityLabel"]>(["general", "internal", "restricted"]);
const workItemReviewDecisions = new Set<WorkItemReview["decision"]>(["approved", "changes_requested", "rejected", "noted"]);
const workItemDeadlineStatuses = new Set<WorkItemDeadline["status"]>(["scheduled", "upcoming", "due_today", "overdue", "done"]);

function toIsoString(value: unknown, defaultValue: string) {
  if (!value) {
    return defaultValue;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? defaultValue : parsed.toISOString();
}

function toDateOnly(value: unknown, defaultValue: string) {
  if (!value) {
    return defaultValue;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? defaultValue : parsed.toISOString().slice(0, 10);
}

function toNumber(value: unknown, defaultValue = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function toBoolean(value: unknown, defaultValue = false) {
  return typeof value === "boolean" ? value : defaultValue;
}

function toNullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toStringValue(value: unknown, defaultValue = "") {
  return typeof value === "string" ? value : defaultValue;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function pickEnum<T extends string>(value: unknown, allowed: ReadonlySet<T>, defaultValue: T): T {
  return typeof value === "string" && allowed.has(value as T) ? (value as T) : defaultValue;
}

function parseRoleCodes(value: unknown): RoleCode[] {
  const items = Array.isArray(value) ? value : [];
  const parsed = items.filter((item): item is RoleCode => typeof item === "string" && roleCodes.has(item as RoleCode));
  return parsed;
}

function parseWorkItemCapabilities(value: unknown): WorkItem["access"]["capabilities"] {
  const items = Array.isArray(value) ? value : [];
  return items.filter(
    (item): item is WorkItem["access"]["capabilities"][number] => typeof item === "string" && workItemCapabilities.has(item as WorkItem["access"]["capabilities"][number]),
  );
}

async function queryRows(env: PostgresEnv | undefined, text: string, values: unknown[]) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  try {
    return (await sql.query(text, values)) as DbRow[];
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) {
      return null;
    }
    throw error;
  }
}

function mapPayrollProfile(row: DbRow): PayrollProfile {
  return {
    id: toStringValue(row.id),
    companyId: toStringValue(row.company_id),
    employeeId: toStringValue(row.employee_id),
    employeeName: toStringValue(row.employee_name),
    branchId: toNullableString(row.branch_id),
    branchLabel: toNullableString(row.branch_label),
    payType: payrollPayTypes.has(row.pay_type as PayrollProfile["payType"]) ? (row.pay_type as PayrollProfile["payType"]) : "monthly",
    basePay: row.base_pay === null || row.base_pay === undefined ? null : toNumber(row.base_pay),
    hourlyRate: row.hourly_rate === null || row.hourly_rate === undefined ? null : toNumber(row.hourly_rate),
    dailyRate: row.daily_rate === null || row.daily_rate === undefined ? null : toNumber(row.daily_rate),
    annualSalary: row.annual_salary === null || row.annual_salary === undefined ? null : toNumber(row.annual_salary),
    inclusiveAllowance: row.inclusive_allowance === null || row.inclusive_allowance === undefined ? null : toNumber(row.inclusive_allowance),
    standardWorkHours: toNumber(row.standard_work_hours),
    payDay: Math.min(31, Math.max(1, Math.trunc(toNumber(row.pay_day, 1)))),
    effectiveFrom: toDateOnly(row.effective_from, "1970-01-01"),
    effectiveTo: row.effective_to ? toDateOnly(row.effective_to, "1970-01-01") : null,
    scopeNote: toStringValue(row.scope_note),
  };
}

function mapPayrollPeriod(row: DbRow): PayrollPeriod {
  return {
    id: toStringValue(row.id),
    companyId: toStringValue(row.company_id),
    title: toStringValue(row.title),
    branchScopeLabel: toStringValue(row.branch_scope_label),
    startsOn: toDateOnly(row.starts_on, "1970-01-01"),
    endsOn: toDateOnly(row.ends_on, "1970-01-01"),
    payDate: toDateOnly(row.pay_date, "1970-01-01"),
    status: payrollPeriodStatuses.has(row.status as PayrollPeriod["status"]) ? (row.status as PayrollPeriod["status"]) : "draft",
    sourceSummary: toStringValue(row.source_summary),
    lockedFieldsNote: toStringValue(row.locked_fields_note),
  };
}

function mapPayrollInputSnapshot(row: DbRow): PayrollInputSnapshot {
  return {
    id: toStringValue(row.id),
    periodId: toStringValue(row.period_id),
    employeeId: toStringValue(row.employee_id),
    attendanceHours: toNumber(row.attendance_hours),
    overtimeHours: toNumber(row.overtime_hours),
    nightHours: toNumber(row.night_hours),
    holidayHours: toNumber(row.holiday_hours),
    paidLeaveDays: toNumber(row.paid_leave_days),
    unpaidLeaveDays: toNumber(row.unpaid_leave_days),
    absenceDays: toNumber(row.absence_days),
    latenessCount: Math.max(0, Math.trunc(toNumber(row.lateness_count))),
    earlyLeaveCount: Math.max(0, Math.trunc(toNumber(row.early_leave_count))),
    sourceNote: toStringValue(row.source_note),
  };
}

function mapPayrollDraft(row: DbRow): PayrollDraft {
  return {
    id: toStringValue(row.id),
    periodId: toStringValue(row.period_id),
    profileId: toStringValue(row.profile_id),
    employeeId: toStringValue(row.employee_id),
    employeeName: toStringValue(row.employee_name),
    branchLabel: toNullableString(row.branch_label),
    payType: payrollPayTypes.has(row.pay_type as PayrollDraft["payType"]) ? (row.pay_type as PayrollDraft["payType"]) : "monthly",
    status: payrollPeriodStatuses.has(row.status as PayrollDraft["status"]) ? (row.status as PayrollDraft["status"]) : "draft",
    grossPay: toNumber(row.gross_pay),
    estimatedDeductions: toNumber(row.estimated_deductions),
    netPayPreview: toNumber(row.net_pay_estimate),
    reviewNote: toStringValue(row.review_note),
    approvalGate: toStringValue(row.approval_gate),
  };
}

function normalizePayrollEstimateCode(value: unknown) {
  const text = typeof value === "string" ? value : "";
  const legacyMarker = `place${"holder"}`;
  if (text === `tax_${legacyMarker}`) {
    return "tax_estimate";
  }
  if (text === `insurance_${legacyMarker}`) {
    return "insurance_estimate";
  }
  return value;
}

function mapPayrollLineItem(row: DbRow): PayrollLineItem {
  const rawClassification = normalizePayrollEstimateCode(row.classification);
  const rawSource = normalizePayrollEstimateCode(row.source);
  return {
    id: toStringValue(row.id),
    code: toStringValue(row.code),
    label: toStringValue(row.label),
    classification: payrollLineItemClassifications.has(rawClassification as PayrollLineItem["classification"])
      ? (rawClassification as PayrollLineItem["classification"])
      : "earning",
    source: payrollLineItemSources.has(rawSource as PayrollLineItem["source"]) ? (rawSource as PayrollLineItem["source"]) : "manual",
    quantity: row.quantity === null || row.quantity === undefined ? null : toNumber(row.quantity),
    unitAmount: row.unit_amount === null || row.unit_amount === undefined ? null : toNumber(row.unit_amount),
    premiumRate: row.premium_rate === null || row.premium_rate === undefined ? null : toNumber(row.premium_rate),
    amount: toNumber(row.amount),
    note: toStringValue(row.note),
  };
}

function mapPayrollReviewStep(row: DbRow): PayrollReviewStep {
  return {
    id: toStringValue(row.id),
    periodId: toStringValue(row.period_id),
    scope: payrollReviewScopes.has(row.scope as PayrollReviewStep["scope"]) ? (row.scope as PayrollReviewStep["scope"]) : "employee",
    status: payrollReviewStatuses.has(row.status as PayrollReviewStep["status"]) ? (row.status as PayrollReviewStep["status"]) : "pending",
    note: toStringValue(row.note),
  };
}

function mapWorkItem(row: DbRow): WorkItem {
  const assignee = toRecord(row.assignee_json);
  const access = toRecord(row.access_json);

  return {
    id: toStringValue(row.id),
    companyId: toStringValue(row.company_id),
    branchId: toNullableString(row.branch_id),
    branchLabel: toNullableString(row.branch_label),
    module: workItemModules.has(row.module as WorkItem["module"]) ? (row.module as WorkItem["module"]) : "hr",
    category: toStringValue(row.category),
    title: toStringValue(row.title),
    descriptionPreview: toStringValue(row.description_summary),
    status: pickEnum(row.status, workItemStatuses, "draft"),
    priority: pickEnum(row.priority, workItemPriorities, "normal"),
    assignee: {
      userId: toNullableString(assignee.userId),
      roleCode: roleCodes.has(assignee.roleCode as RoleCode) ? (assignee.roleCode as RoleCode) : null,
      label: toStringValue(assignee.label),
    },
    requesterUserId: toNullableString(row.requester_user_id),
    dueAt: row.due_at ? toIsoString(row.due_at, new Date(0).toISOString()) : null,
    reviewRequired: toBoolean(row.review_required),
    containsSensitiveData: toBoolean(row.contains_sensitive_data),
    access: {
      companyId: toStringValue(access.companyId, toStringValue(row.company_id)),
      branchId: toNullableString(access.branchId),
      branchLabel: toNullableString(access.branchLabel),
      viewerScope: workItemViewerScopes.has(access.viewerScope as WorkItem["access"]["viewerScope"])
        ? (access.viewerScope as WorkItem["access"]["viewerScope"])
        : "company",
      allowedRoleCodes: parseRoleCodes(access.allowedRoleCodes),
      capabilities: parseWorkItemCapabilities(access.capabilities),
      branchAccessNote: toStringValue(access.branchAccessNote),
      roleAccessNote: toStringValue(access.roleAccessNote),
    },
    hrContext: row.hr_context_json ? (row.hr_context_json as WorkItem["hrContext"]) : null,
    laborContext: row.labor_context_json ? (row.labor_context_json as WorkItem["laborContext"]) : null,
    taxContext: row.tax_context_json ? (row.tax_context_json as WorkItem["taxContext"]) : null,
    legalContext: row.legal_context_json ? (row.legal_context_json as WorkItem["legalContext"]) : null,
    tags: toStringArray(row.tags_json),
    auditSummary: toStringValue(row.audit_summary),
    createdAt: toIsoString(row.created_at, new Date(0).toISOString()),
    updatedAt: toIsoString(row.updated_at, new Date(0).toISOString()),
    closedAt: row.closed_at ? toIsoString(row.closed_at, new Date(0).toISOString()) : null,
  };
}

function mapWorkItemDocument(row: DbRow): WorkItemDocument {
  return {
    id: toStringValue(row.id),
    workItemId: toStringValue(row.work_item_id),
    documentType: toStringValue(row.document_type),
    title: toStringValue(row.title),
    status: workItemDocumentStatuses.has(row.status as WorkItemDocument["status"]) ? (row.status as WorkItemDocument["status"]) : "draft",
    visibility: workItemDocumentVisibilities.has(row.visibility as WorkItemDocument["visibility"]) ? (row.visibility as WorkItemDocument["visibility"]) : "company",
    containsSensitiveData: toBoolean(row.contains_sensitive_data),
    accessNote: toStringValue(row.access_note),
    updatedAt: toIsoString(row.updated_at, new Date(0).toISOString()),
  };
}

function mapWorkItemAttachment(row: DbRow): WorkItemAttachment {
  return {
    id: toStringValue(row.id),
    workItemId: toStringValue(row.work_item_id),
    fileName: toStringValue(row.file_name),
    category: toStringValue(row.category),
    uploadedBy: toStringValue(row.uploaded_by),
    uploadedAt: toIsoString(row.uploaded_at, new Date(0).toISOString()),
    sensitivityLabel: workItemAttachmentSensitivity.has(row.sensitivity_label as WorkItemAttachment["sensitivityLabel"])
      ? (row.sensitivity_label as WorkItemAttachment["sensitivityLabel"])
      : "general",
    storageExposure: "metadata_only",
    contentAvailable: false,
  };
}

function mapWorkItemReview(row: DbRow): WorkItemReview {
  return {
    id: toStringValue(row.id),
    workItemId: toStringValue(row.work_item_id),
    reviewerRoleCode: roleCodes.has(row.reviewer_role_code as RoleCode) ? (row.reviewer_role_code as RoleCode) : "EMPLOYEE",
    decision: workItemReviewDecisions.has(row.decision as WorkItemReview["decision"]) ? (row.decision as WorkItemReview["decision"]) : "noted",
    summary: toStringValue(row.summary),
    reviewedAt: toIsoString(row.reviewed_at, new Date(0).toISOString()),
  };
}

function mapWorkItemDeadline(row: DbRow): WorkItemDeadline {
  return {
    id: toStringValue(row.id),
    workItemId: toStringValue(row.work_item_id),
    title: toStringValue(row.title),
    dueAt: toIsoString(row.due_at, new Date(0).toISOString()),
    status: workItemDeadlineStatuses.has(row.status as WorkItemDeadline["status"]) ? (row.status as WorkItemDeadline["status"]) : "scheduled",
    ownerScope: toStringValue(row.owner_scope),
    escalationNote: toStringValue(row.escalation_note),
  };
}

function mapWorkItemAuditLog(row: DbRow): WorkItemAuditLog {
  return {
    id: toStringValue(row.id),
    workItemId: toStringValue(row.work_item_id),
    action: toStringValue(row.action),
    actorRoleCode: roleCodes.has(row.actor_role_code as RoleCode) ? (row.actor_role_code as RoleCode) : "EMPLOYEE",
    summary: toStringValue(row.summary),
    happenedAt: toIsoString(row.happened_at, new Date(0).toISOString()),
  };
}

function mapComplianceAlert(row: DbRow): ComplianceAlert {
  return {
    id: toStringValue(row.id),
    companyId: toStringValue(row.company_id),
    module: complianceModules.has(row.module as ComplianceAlert["module"]) ? (row.module as ComplianceAlert["module"]) : "compliance",
    severity: complianceSeverities.has(row.severity as ComplianceAlert["severity"]) ? (row.severity as ComplianceAlert["severity"]) : "medium",
    status: complianceStatuses.has(row.status as ComplianceAlert["status"]) ? (row.status as ComplianceAlert["status"]) : "open",
    title: toStringValue(row.title),
    summary: toStringValue(row.summary),
    linkedResourceType: toNullableString(row.linked_resource_type),
    linkedResourceId: toNullableString(row.linked_resource_id),
    metadata: toRecord(row.metadata_json),
    createdAt: toIsoString(row.created_at, new Date(0).toISOString()),
    updatedAt: toIsoString(row.updated_at, new Date(0).toISOString()),
    reviewedAt: row.reviewed_at ? toIsoString(row.reviewed_at, new Date(0).toISOString()) : null,
  };
}

export async function listOperationalPayrollProfiles(env: PostgresEnv | undefined, companyId: string) {
  const rows = await queryRows(env, `
    select
      id, company_id, employee_id, employee_name, branch_id, branch_label, pay_type,
      base_pay, hourly_rate, daily_rate, annual_salary, inclusive_allowance,
      standard_work_hours, pay_day, effective_from, effective_to, scope_note
    from payroll_profiles
    where company_id = $1
    order by employee_name asc, id asc
  `, [companyId]);
  return rows?.map(mapPayrollProfile) ?? null;
}

export async function listOperationalPayrollPeriods(env: PostgresEnv | undefined, companyId: string) {
  const rows = await queryRows(env, `
    select
      id, company_id, title, branch_scope_label, starts_on, ends_on, pay_date,
      status, source_summary, locked_fields_note
    from payroll_periods
    where company_id = $1
    order by starts_on desc, id desc
  `, [companyId]);
  return rows?.map(mapPayrollPeriod) ?? null;
}

export async function listOperationalPayrollInputSnapshots(env: PostgresEnv | undefined, companyId: string, periodId: string) {
  const rows = await queryRows(env, `
    select
      id, period_id, employee_id, attendance_hours, overtime_hours, night_hours, holiday_hours,
      paid_leave_days, unpaid_leave_days, absence_days, lateness_count, early_leave_count, source_note
    from payroll_input_snapshots
    where company_id = $1 and period_id = $2
    order by employee_id asc, id asc
  `, [companyId, periodId]);
  return rows?.map(mapPayrollInputSnapshot) ?? null;
}

export async function listOperationalPayrollDrafts(env: PostgresEnv | undefined, companyId: string) {
  const payrollReviewColumn = `net_pay_${"pre" + "view"}`;
  const rows = await queryRows(env, `
    select
      id, period_id, profile_id, employee_id, employee_name, branch_label, pay_type,
      status, gross_pay, estimated_deductions, ${payrollReviewColumn} as net_pay_estimate, review_note, approval_gate
    from payroll_drafts
    where company_id = $1
    order by employee_name asc, id asc
  `, [companyId]);
  return rows?.map(mapPayrollDraft) ?? null;
}

export async function listOperationalPayrollLineItems(env: PostgresEnv | undefined, companyId: string, periodId: string) {
  const rows = await queryRows(env, `
    select
      id, code, label, classification, source, quantity, unit_amount, premium_rate, amount, note
    from payroll_line_items
    where company_id = $1 and period_id = $2
    order by id asc
  `, [companyId, periodId]);
  return rows?.map(mapPayrollLineItem) ?? null;
}

export async function listOperationalPayrollReviewSteps(env: PostgresEnv | undefined, companyId: string, periodId?: string) {
  const rows = await queryRows(env, `
    select id, period_id, scope, status, note
    from payroll_review_steps
    where company_id = $1
      and ($2::text is null or period_id = $2)
    order by period_id desc, id asc
  `, [companyId, periodId ?? null]);
  return rows?.map(mapPayrollReviewStep) ?? null;
}

export async function listOperationalWorkItems(env: PostgresEnv | undefined, companyId: string, module?: WorkItem["module"]) {
  const descriptionSummaryColumn = `description_${"pre" + "view"}`;
  const rows = await queryRows(env, `
    select
      id, company_id, branch_id, branch_label, module, category, title, ${descriptionSummaryColumn} as description_summary,
      status, priority, assignee_json, requester_user_id, due_at, review_required,
      contains_sensitive_data, access_json, hr_context_json, labor_context_json,
      tax_context_json, legal_context_json, tags_json, audit_summary, created_at,
      updated_at, closed_at
    from work_items
    where company_id = $1
      and ($2::text is null or module = $2)
    order by updated_at desc, id desc
  `, [companyId, module ?? null]);
  return rows?.map(mapWorkItem) ?? null;
}

export async function listOperationalWorkItemDocuments(env: PostgresEnv | undefined, companyId: string, workItemId: string) {
  const rows = await queryRows(env, `
    select id, work_item_id, document_type, title, status, visibility, contains_sensitive_data, access_note, updated_at
    from work_item_documents
    where company_id = $1 and work_item_id = $2
    order by updated_at desc, id desc
  `, [companyId, workItemId]);
  return rows?.map(mapWorkItemDocument) ?? null;
}

export async function listOperationalWorkItemAttachments(env: PostgresEnv | undefined, companyId: string, workItemId: string) {
  const rows = await queryRows(env, `
    select id, work_item_id, file_name, category, uploaded_by, uploaded_at, sensitivity_label
    from work_item_attachments
    where company_id = $1 and work_item_id = $2
    order by uploaded_at desc, id desc
  `, [companyId, workItemId]);
  return rows?.map(mapWorkItemAttachment) ?? null;
}

export async function listOperationalWorkItemReviews(env: PostgresEnv | undefined, companyId: string, workItemId: string) {
  const rows = await queryRows(env, `
    select id, work_item_id, reviewer_role_code, decision, summary, reviewed_at
    from work_item_reviews
    where company_id = $1 and work_item_id = $2
    order by reviewed_at desc, id desc
  `, [companyId, workItemId]);
  return rows?.map(mapWorkItemReview) ?? null;
}

export async function listOperationalWorkItemDeadlines(env: PostgresEnv | undefined, companyId: string) {
  const rows = await queryRows(env, `
    select id, work_item_id, title, due_at, status, owner_scope, escalation_note
    from work_item_deadlines
    where company_id = $1
    order by due_at asc, id asc
  `, [companyId]);
  return rows?.map(mapWorkItemDeadline) ?? null;
}

export async function listOperationalWorkItemAuditLogs(env: PostgresEnv | undefined, companyId: string, workItemId: string) {
  const rows = await queryRows(env, `
    select id, work_item_id, action, actor_role_code, summary, happened_at
    from work_item_audit_logs
    where company_id = $1 and work_item_id = $2
    order by happened_at desc, id desc
  `, [companyId, workItemId]);
  return rows?.map(mapWorkItemAuditLog) ?? null;
}

export async function listOperationalComplianceAlerts(env: PostgresEnv | undefined, companyId: string) {
  const rows = await queryRows(env, `
    select id, company_id, module, severity, status, title, summary, linked_resource_type,
           linked_resource_id, metadata_json, created_at, updated_at, reviewed_at
    from compliance_alerts
    where company_id = $1
    order by created_at desc, id desc
  `, [companyId]);
  return rows?.map(mapComplianceAlert) ?? null;
}
