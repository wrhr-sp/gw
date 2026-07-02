import type {
  ApprovalDocument,
  ApprovalForm,
  ApprovalLine,
  ApprovalReference,
  ApprovalStep,
  AttendanceCorrectionRequest,
  AttendanceRecord,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
} from "@gw/shared";
import { findCurrentPendingApprovalStep, hasPendingApprovalSteps } from "./approval-steps";
import { createOperationalSql, type PostgresEnv } from "./postgres";

type DbRow = Record<string, any>;
type TimestampValue = string | Date | null | undefined;

function toIsoString(value: TimestampValue, fallback: string) {
  if (!value) return fallback;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function toDateOnly(value: string | Date | null | undefined, fallback: string) {
  if (!value) return fallback;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString().slice(0, 10);
}

function toNumber(value: number | string | null | undefined, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapAttendanceRecord(row: DbRow): AttendanceRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    status: row.status,
    workDate: toDateOnly(row.work_date, "1970-01-01"),
    checkInAt: row.check_in_at ? toIsoString(row.check_in_at, new Date(0).toISOString()) : null,
    checkOutAt: row.check_out_at ? toIsoString(row.check_out_at, new Date(0).toISOString()) : null,
    source: row.source,
    note: row.note ?? null,
    createdAt: toIsoString(row.created_at, new Date(0).toISOString()),
    updatedAt: toIsoString(row.updated_at, new Date(0).toISOString()),
  } as AttendanceRecord;
}

function mapAttendanceCorrectionRequest(row: DbRow): AttendanceCorrectionRequest {
  return {
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    attendanceRecordId: row.attendance_record_id,
    status: row.status,
    requestedBy: row.requested_by,
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at ? toIsoString(row.reviewed_at, new Date(0).toISOString()) : null,
    reason: row.reason,
    requestedCheckInAt: row.requested_check_in_at ? toIsoString(row.requested_check_in_at, new Date(0).toISOString()) : null,
    requestedCheckOutAt: row.requested_check_out_at ? toIsoString(row.requested_check_out_at, new Date(0).toISOString()) : null,
    note: row.note ?? null,
    createdAt: toIsoString(row.created_at, new Date(0).toISOString()),
    updatedAt: toIsoString(row.updated_at, new Date(0).toISOString()),
  } as AttendanceCorrectionRequest;
}

function mapLeaveType(row: DbRow): LeaveType {
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    unit: row.unit,
    status: row.status,
  } as LeaveType;
}

function mapLeaveBalance(row: DbRow): LeaveBalance {
  return {
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    leaveTypeId: row.leave_type_id,
    asOfDate: toDateOnly(row.as_of_date, "1970-01-01"),
    openingDays: toNumber(row.opening_days),
    usedDays: toNumber(row.used_days),
    reservedDays: toNumber(row.reserved_days),
    remainingDays: toNumber(row.remaining_days),
  } as LeaveBalance;
}

function mapLeaveRequest(row: DbRow): LeaveRequest {
  return {
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    leaveTypeId: row.leave_type_id,
    status: row.status,
    approvalStatus: row.approval_status ?? (row.status === "approved" ? "approved" : row.status === "rejected" ? "rejected" : "pending"),
    startDate: toDateOnly(row.start_date, "1970-01-01"),
    endDate: toDateOnly(row.end_date, "1970-01-01"),
    unit: row.unit ?? "day",
    days: toNumber(row.days, 1),
    reason: row.reason,
    note: row.note ?? null,
    requestedBy: row.requested_by,
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at ? toIsoString(row.reviewed_at, new Date(0).toISOString()) : null,
    createdAt: toIsoString(row.created_at, new Date(0).toISOString()),
    updatedAt: toIsoString(row.updated_at, new Date(0).toISOString()),
  } as LeaveRequest;
}

function mapApprovalForm(row: DbRow): ApprovalForm {
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    title: row.title,
    category: row.category,
    fieldSummary: row.field_summary,
    status: row.status,
    createdBy: row.created_by ?? "system",
    createdAt: toIsoString(row.created_at, new Date(0).toISOString()),
    updatedAt: toIsoString(row.updated_at, new Date(0).toISOString()),
  } as ApprovalForm;
}

function mapApprovalStep(row: DbRow): ApprovalStep {
  return {
    id: row.id,
    documentId: row.document_id ?? null,
    lineId: row.line_id ?? null,
    stepOrder: Number(row.step_order ?? 0),
    approverEmployeeId: row.approver_employee_id,
    stepType: row.step_type,
    decisionStatus: row.decision_status,
    decidedAt: row.decided_at ? toIsoString(row.decided_at, new Date(0).toISOString()) : null,
    decisionComment: row.decision_comment ?? null,
  } as ApprovalStep;
}

function mapApprovalLine(row: DbRow, steps: ApprovalStep[]): ApprovalLine {
  return {
    id: row.id,
    companyId: row.company_id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdBy: row.created_by ?? "system",
    createdAt: toIsoString(row.created_at, new Date(0).toISOString()),
    updatedAt: toIsoString(row.updated_at, new Date(0).toISOString()),
    steps,
  } as ApprovalLine;
}

function mapApprovalDocument(row: DbRow): ApprovalDocument {
  return {
    id: row.id,
    companyId: row.company_id,
    formId: row.form_id,
    lineId: row.line_id,
    drafterEmployeeId: row.drafter_employee_id,
    title: row.title,
    summary: row.summary ?? "",
    documentNumber: row.document_number,
    status: row.status,
    submittedAt: row.submitted_at ? toIsoString(row.submitted_at, new Date(0).toISOString()) : null,
    completedAt: row.completed_at ? toIsoString(row.completed_at, new Date(0).toISOString()) : null,
    createdBy: row.created_by,
    createdAt: toIsoString(row.created_at, new Date(0).toISOString()),
    updatedAt: toIsoString(row.updated_at, new Date(0).toISOString()),
    placeholder: true,
  } as ApprovalDocument;
}

function mapApprovalReference(row: DbRow): ApprovalReference {
  return {
    id: row.id,
    documentId: row.document_id,
    employeeId: row.employee_id,
    referenceType: row.reference_type,
    readAt: row.read_at ? toIsoString(row.read_at, new Date(0).toISOString()) : null,
  } as ApprovalReference;
}

async function query(env: PostgresEnv | undefined, strings: TemplateStringsArray, ...values: any[]) {
  const sql = createOperationalSql(env);
  if (!sql) return null;

  let text = "";
  for (let index = 0; index < values.length; index += 1) {
    text += `${strings[index] ?? ""}$${index + 1}`;
  }
  text += strings[values.length] ?? "";

  try {
    return (await sql.query(text, values)) as DbRow[];
  } catch (error) {
    console.error("Operational workflow query failed", error instanceof Error ? error.message : "unknown database error");
    return null;
  }
}

async function listApprovalLineTemplateSteps(env: PostgresEnv | undefined, companyId: string) {
  return await query(env, [
    `
    select id, company_id, document_id, line_id, step_order, approver_employee_id, step_type, decision_status, decided_at, decision_comment
    from approval_steps
    where company_id = `,
    `
      and document_id is null
    order by line_id asc nulls last, step_order asc
  `,
  ] as unknown as TemplateStringsArray, companyId);
}

export async function listOperationalAttendanceRecords(env: PostgresEnv | undefined, companyId: string, employeeId: string, filters?: { workDateFrom?: string; workDateTo?: string }) {
  const rows = await query(env, [
    `
    select id, company_id, employee_id, status, work_date, check_in_at, check_out_at, source, note, created_at, updated_at
    from attendance_records
    where company_id = `,
    `
      and employee_id = `,
    `
      and (`,
    `::date is null or work_date >= `,
    `::date)
      and (`,
    `::date is null or work_date <= `,
    `::date)
      and deleted_at is null
    order by work_date desc, updated_at desc
  `,
  ] as unknown as TemplateStringsArray, companyId, employeeId, filters?.workDateFrom ?? null, filters?.workDateFrom ?? null, filters?.workDateTo ?? null, filters?.workDateTo ?? null);
  return rows?.map(mapAttendanceRecord) ?? null;
}

export async function upsertOperationalAttendanceRecord(env: PostgresEnv | undefined, input: { id: string; companyId: string; employeeId: string; workDate: string; status: AttendanceRecord["status"]; checkInAt: string | null; checkOutAt: string | null; source: AttendanceRecord["source"]; note: string | null; createdBy: string; }) {
  const sql = createOperationalSql(env);
  if (!sql) return null;

  try {
    const rows = (await sql.query(
      `
      insert into attendance_records (
        id, company_id, employee_id, work_date, status, check_in_at, check_out_at, source, note, created_by
      ) values (
        $1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10
      )
      on conflict (company_id, employee_id, work_date)
      do update set
        status = excluded.status,
        check_in_at = coalesce(excluded.check_in_at, attendance_records.check_in_at),
        check_out_at = excluded.check_out_at,
        source = excluded.source,
        note = excluded.note,
        updated_at = now()
      returning id, company_id, employee_id, status, work_date, check_in_at, check_out_at, source, note, created_at, updated_at
    `,
      [input.id, input.companyId, input.employeeId, input.workDate, input.status, input.checkInAt, input.checkOutAt, input.source, input.note, input.createdBy],
    )) as DbRow[];
    return rows?.[0] ? mapAttendanceRecord(rows[0]) : null;
  } catch (error) {
    console.error("Operational attendance upsert failed", error instanceof Error ? error.message : "unknown database error");
    return null;
  }
}

export async function createOperationalAttendanceCorrectionRequest(env: PostgresEnv | undefined, input: { id: string; companyId: string; employeeId: string; attendanceRecordId: string; requestedBy: string; reason: string; requestedCheckInAt?: string | null; requestedCheckOutAt?: string | null; note?: string | null; }) {
  const rows = await query(env, [
    `
    insert into attendance_correction_requests (
      id, company_id, employee_id, attendance_record_id, status, requested_by, reason, requested_check_in_at, requested_check_out_at, note
    ) values (
      `,
    `, `,
    `, `,
    `, `,
    `, 'requested', `,
    `, `,
    `, `,
    `, `,
    `
    )
    returning id, company_id, employee_id, attendance_record_id, status, requested_by, reviewed_by, reviewed_at, reason, requested_check_in_at, requested_check_out_at, note, created_at, updated_at
  `,
  ] as unknown as TemplateStringsArray, input.id, input.companyId, input.employeeId, input.attendanceRecordId, input.requestedBy, input.reason, input.requestedCheckInAt ?? null, input.requestedCheckOutAt ?? null, input.note ?? null);
  return rows?.[0] ? mapAttendanceCorrectionRequest(rows[0]) : null;
}

export async function listOperationalLeaveTypes(env: PostgresEnv | undefined, companyId: string) {
  const rows = await query(env, [
    `
    select id, company_id, code, name, unit, status, created_at, updated_at
    from leave_types
    where company_id = `,
    `
      and deleted_at is null
    order by code asc
  `,
  ] as unknown as TemplateStringsArray, companyId);
  return rows?.map(mapLeaveType) ?? null;
}

export async function listOperationalLeaveBalances(env: PostgresEnv | undefined, companyId: string, employeeId: string) {
  const rows = await query(env, [
    `
    select id, company_id, employee_id, leave_type_id, as_of_date, opening_days, used_days, reserved_days, remaining_days
    from leave_balances
    where company_id = `,
    `
      and employee_id = `,
    `
    order by as_of_date desc, leave_type_id asc
  `,
  ] as unknown as TemplateStringsArray, companyId, employeeId);
  return rows?.map(mapLeaveBalance) ?? null;
}

export async function listOperationalLeaveRequests(env: PostgresEnv | undefined, companyId: string) {
  const rows = await query(env, [
    `
    select id, company_id, employee_id, leave_type_id, status, approval_status, start_date, end_date, unit, days, requested_by, reviewed_by, reviewed_at, reason, note, created_at, updated_at
    from leave_requests
    where company_id = `,
    `
      and deleted_at is null
    order by start_date desc, created_at desc
  `,
  ] as unknown as TemplateStringsArray, companyId);
  return rows?.map(mapLeaveRequest) ?? null;
}

export async function createOperationalLeaveRequest(env: PostgresEnv | undefined, input: { id: string; companyId: string; employeeId: string; leaveTypeId: string; startDate: string; endDate: string; unit: LeaveRequest["unit"]; days: number; requestedBy: string; reason: string; note?: string | null; }) {
  const sql = createOperationalSql(env);
  if (!sql) return null;

  try {
    const rows = (await sql.query(
      `
      insert into leave_requests (
        id, company_id, employee_id, leave_type_id, status, approval_status, start_date, end_date, unit, days, requested_by, reason, note
      ) values (
        $1, $2, $3, $4, 'pending_approval', 'pending', $5::date, $6::date, $7, $8, $9, $10, $11
      )
      returning id, company_id, employee_id, leave_type_id, status, approval_status, start_date, end_date, unit, days, requested_by, reviewed_by, reviewed_at, reason, note, created_at, updated_at
    `,
      [input.id, input.companyId, input.employeeId, input.leaveTypeId, input.startDate, input.endDate, input.unit, input.days, input.requestedBy, input.reason, input.note ?? null],
    )) as DbRow[];
    return rows?.[0] ? mapLeaveRequest(rows[0]) : null;
  } catch (error) {
    console.error("Operational leave request insert failed", error instanceof Error ? error.message : "unknown database error");
    return null;
  }
}

export async function updateOperationalLeaveRequestReview(env: PostgresEnv | undefined, input: { companyId: string; requestId: string; approvalStatus: LeaveRequest["approvalStatus"]; reviewedBy: string; reason: string; }) {
  const status = input.approvalStatus === "approved" ? "approved" : "rejected";
  const rows = await query(env, [
    `
    update leave_requests
    set approval_status = `,
    `,
        status = `,
    `,
        reviewed_by = `,
    `,
        reviewed_at = now(),
        note = `,
    `,
        updated_at = now()
    where company_id = `,
    `
      and id = `,
    `
      and deleted_at is null
    returning id, company_id, employee_id, leave_type_id, status, approval_status, start_date, end_date, unit, days, requested_by, reviewed_by, reviewed_at, reason, note, created_at, updated_at
  `,
  ] as unknown as TemplateStringsArray, input.approvalStatus, status, input.reviewedBy, input.reason, input.companyId, input.requestId);
  return rows?.[0] ? mapLeaveRequest(rows[0]) : null;
}

export async function listOperationalApprovalForms(env: PostgresEnv | undefined, companyId: string) {
  const rows = await query(env, [
    `
    select id, company_id, code, title, category, field_summary, status, created_by, created_at, updated_at
    from approval_forms
    where company_id = `,
    `
    order by updated_at desc, title asc
  `,
  ] as unknown as TemplateStringsArray, companyId);
  return rows?.map(mapApprovalForm) ?? null;
}

export async function createOperationalApprovalForm(env: PostgresEnv | undefined, input: { id: string; companyId: string; code: string; title: string; category: string; fieldSummary: string; createdBy: string; }) {
  const rows = await query(env, [
    `
    insert into approval_forms (id, company_id, code, title, category, field_summary, status, created_by)
    values (`,
    `, `,
    `, `,
    `, `,
    `, `,
    `, 'active', `,
    `)
    returning id, company_id, code, title, category, field_summary, status, created_by, created_at, updated_at
  `,
  ] as unknown as TemplateStringsArray, input.id, input.companyId, input.code, input.title, input.category, input.fieldSummary, input.createdBy);
  return rows?.[0] ? mapApprovalForm(rows[0]) : null;
}

export async function listOperationalApprovalLines(env: PostgresEnv | undefined, companyId: string) {
  const rows = await query(env, [
    `
    select id, company_id, title, description, status, created_by, created_at, updated_at
    from approval_lines
    where company_id = `,
    `
    order by updated_at desc, title asc
  `,
  ] as unknown as TemplateStringsArray, companyId);
  if (!rows) return null;
  const stepRows = await listApprovalLineTemplateSteps(env, companyId);
  const stepMap = new Map<string, ApprovalStep[]>();
  for (const row of stepRows ?? []) {
    const lineId = row.line_id;
    if (!lineId) continue;
    const bucket = stepMap.get(lineId) ?? [];
    bucket.push(mapApprovalStep(row));
    stepMap.set(lineId, bucket.sort((a, b) => a.stepOrder - b.stepOrder));
  }
  return (rows ?? []).map((row) => mapApprovalLine(row, stepMap.get(row.id) ?? []));
}

export async function createOperationalApprovalLine(env: PostgresEnv | undefined, input: { id: string; companyId: string; title: string; description: string; createdBy: string; steps: Array<{ id: string; stepOrder: number; approverEmployeeId: string; stepType: ApprovalStep["stepType"]; }>; }) {
  const rows = await query(env, [
    `
    insert into approval_lines (id, company_id, title, description, status, created_by)
    values (`,
    `, `,
    `, `,
    `, `,
    `, 'active', `,
    `)
    returning id, company_id, title, description, status, created_by, created_at, updated_at
  `,
  ] as unknown as TemplateStringsArray, input.id, input.companyId, input.title, input.description, input.createdBy);
  const sql = createOperationalSql(env);
  if (!sql || !rows?.[0]) return null;
  await Promise.all(input.steps.map((step) => sql`
    insert into approval_steps (
      id, company_id, document_id, line_id, step_order, approver_employee_id, step_type, decision_status, created_by
    ) values (
      ${step.id}, ${input.companyId}, null, ${input.id}, ${step.stepOrder}, ${step.approverEmployeeId}, ${step.stepType}, 'pending', ${input.createdBy}
    )
  `));
  return mapApprovalLine(rows[0], input.steps.slice().sort((a, b) => a.stepOrder - b.stepOrder).map((step) => mapApprovalStep({ id: step.id, document_id: null, line_id: input.id, step_order: step.stepOrder, approver_employee_id: step.approverEmployeeId, step_type: step.stepType, decision_status: 'pending', decided_at: null, decision_comment: null })));
}

export async function listOperationalApprovalDocuments(env: PostgresEnv | undefined, companyId: string) {
  const rows = await query(env, [
    `
    select id, company_id, form_id, line_id, drafter_employee_id, title, summary, document_number, status, submitted_at, completed_at, created_by, created_at, updated_at
    from approval_documents
    where company_id = `,
    `
    order by created_at desc
  `,
  ] as unknown as TemplateStringsArray, companyId);
  return rows?.map(mapApprovalDocument) ?? null;
}

export async function findOperationalApprovalDocument(env: PostgresEnv | undefined, companyId: string, documentId: string) {
  const rows = await query(env, [
    `
    select id, company_id, form_id, line_id, drafter_employee_id, title, summary, document_number, status, submitted_at, completed_at, created_by, created_at, updated_at
    from approval_documents
    where company_id = `,
    `
      and id = `,
    `
    limit 1
  `,
  ] as unknown as TemplateStringsArray, companyId, documentId);
  return rows?.[0] ? mapApprovalDocument(rows[0]) : null;
}

export async function listOperationalApprovalSteps(env: PostgresEnv | undefined, companyId: string, documentId: string) {
  const rows = await query(env, [
    `
    select id, company_id, document_id, line_id, step_order, approver_employee_id, step_type, decision_status, decided_at, decision_comment
    from approval_steps
    where company_id = `,
    `
      and document_id = `,
    `
    order by step_order asc
  `,
  ] as unknown as TemplateStringsArray, companyId, documentId);
  return rows?.map(mapApprovalStep) ?? null;
}

export async function listOperationalApprovalReferences(env: PostgresEnv | undefined, companyId: string, documentId: string) {
  const rows = await query(env, [
    `
    select id, company_id, document_id, employee_id, reference_type, read_at
    from approval_references
    where company_id = `,
    `
      and document_id = `,
    `
      and status = 'active'
    order by created_at asc
  `,
  ] as unknown as TemplateStringsArray, companyId, documentId);
  return rows?.map(mapApprovalReference) ?? null;
}

export async function createOperationalApprovalDocument(env: PostgresEnv | undefined, input: { id: string; companyId: string; formId: string; lineId: string; drafterEmployeeId: string; title: string; summary: string; documentNumber: string; createdBy: string; referenceEmployeeIds: string[]; agreementEmployeeIds: string[]; }) {
  const templateRows = await query(env, [
    `
    select id, company_id, document_id, line_id, step_order, approver_employee_id, step_type, decision_status, decided_at, decision_comment
    from approval_steps
    where company_id = `,
    `
      and line_id = `,
    `
      and document_id is null
    order by step_order asc
  `,
  ] as unknown as TemplateStringsArray, input.companyId, input.lineId);
  const rows = await query(env, [
    `
    insert into approval_documents (
      id, company_id, form_id, line_id, drafter_employee_id, title, summary, document_number, status, submitted_at, created_by
    ) values (
      `,
    `, `,
    `, `,
    `, `,
    `, `,
    `, `,
    `, `,
    `, 'pending_approval', now(), `,
    `)
    returning id, company_id, form_id, line_id, drafter_employee_id, title, summary, document_number, status, submitted_at, completed_at, created_by, created_at, updated_at
  `,
  ] as unknown as TemplateStringsArray, input.id, input.companyId, input.formId, input.lineId, input.drafterEmployeeId, input.title, input.summary, input.documentNumber, input.createdBy);
  const sql = createOperationalSql(env);
  if (!sql || !rows?.[0]) return null;
  await Promise.all((templateRows ?? []).map((step) => sql`
    insert into approval_steps (
      id, company_id, document_id, line_id, step_order, approver_employee_id, step_type, decision_status, created_by
    ) values (
      ${`${input.id}_step_${step.step_order}`}, ${input.companyId}, ${input.id}, ${input.lineId}, ${step.step_order}, ${step.approver_employee_id}, ${step.step_type}, 'pending', ${input.createdBy}
    )
  `));
  const references = [
    ...input.referenceEmployeeIds.map((employeeId, index) => ({ id: `${input.id}_reference_${index + 1}`, employeeId, referenceType: 'reference' })),
    ...input.agreementEmployeeIds.map((employeeId, index) => ({ id: `${input.id}_agreement_${index + 1}`, employeeId, referenceType: 'agreement' })),
  ];
  await Promise.all(references.map((reference) => sql`
    insert into approval_references (id, company_id, document_id, employee_id, reference_type, created_by, status)
    values (${reference.id}, ${input.companyId}, ${input.id}, ${reference.employeeId}, ${reference.referenceType}, ${input.createdBy}, 'active')
  `));
  return mapApprovalDocument(rows[0]);
}

export async function updateOperationalApprovalDocumentDecision(env: PostgresEnv | undefined, input: { companyId: string; documentId: string; approverEmployeeId: string; decision: 'approved' | 'rejected'; reason: string; reviewedBy: string; }) {
  const sql = createOperationalSql(env);
  if (!sql) return undefined;
  const existingSteps = await listOperationalApprovalSteps(env, input.companyId, input.documentId);
  const currentPendingStep = findCurrentPendingApprovalStep(existingSteps ?? []);
  if (!currentPendingStep || currentPendingStep.approverEmployeeId !== input.approverEmployeeId) {
    return null;
  }

  const stepRows = await sql`
    update approval_steps
    set decision_status = ${input.decision},
        decision_comment = ${input.reason},
        decided_at = now(),
        updated_at = now()
    where company_id = ${input.companyId}
      and document_id = ${input.documentId}
      and id = ${currentPendingStep.id}
      and decision_status = 'pending'
    returning id, company_id, document_id, line_id, step_order, approver_employee_id, step_type, decision_status, decided_at, decision_comment
  `;
  if (!stepRows[0]) {
    return null;
  }

  const remainingSteps = (existingSteps ?? []).map((step) =>
    step.id === currentPendingStep.id
      ? {
          ...step,
          decisionStatus: input.decision,
          decisionComment: input.reason,
          decidedAt: new Date().toISOString(),
        }
      : step,
  );
  const nextDocumentStatus = input.decision === 'rejected'
    ? 'rejected'
    : hasPendingApprovalSteps(remainingSteps)
      ? 'pending_approval'
      : 'approved';
  const rows = nextDocumentStatus === 'pending_approval'
    ? await sql`
        update approval_documents
        set status = ${nextDocumentStatus},
            completed_at = null,
            updated_at = now(),
            created_by = coalesce(created_by, ${input.reviewedBy})
        where company_id = ${input.companyId}
          and id = ${input.documentId}
        returning id, company_id, form_id, line_id, drafter_employee_id, title, summary, document_number, status, submitted_at, completed_at, created_by, created_at, updated_at
      `
    : await sql`
        update approval_documents
        set status = ${nextDocumentStatus},
            completed_at = now(),
            updated_at = now(),
            created_by = coalesce(created_by, ${input.reviewedBy})
        where company_id = ${input.companyId}
          and id = ${input.documentId}
        returning id, company_id, form_id, line_id, drafter_employee_id, title, summary, document_number, status, submitted_at, completed_at, created_by, created_at, updated_at
      `;
  return rows?.[0] ? mapApprovalDocument(rows[0]) : null;
}
