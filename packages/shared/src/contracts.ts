import { z } from "zod";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD date");

export const appRoutes = {
  health: "/api/health",
  auth: {
    login: "/api/auth/login",
    logout: "/api/auth/logout",
  },
  me: "/api/me",
  security: {
    secondaryPassword: "/api/security/secondary-password",
    verifySecondaryPassword: "/api/security/secondary-password/verify",
  },
  user: {
    preferences: "/api/user/preferences",
  },
  home: {
    shortcuts: "/api/home/shortcuts",
  },
  org: {
    companies: "/api/companies",
    employees: "/api/employees",
    departments: "/api/departments",
    roles: "/api/roles",
    permissions: "/api/permissions",
    branches: "/api/branches",
  },
  notifications: "/api/notifications",
  admin: {
    invites: "/api/admin/invites",
    users: "/api/admin/users",
    permissions: "/api/admin/permissions",
    policies: "/api/admin/policies",
    policyDocuments: "/api/admin/policies/documents",
    policyBoards: "/api/admin/policies/boards",
    auditLogs: "/api/admin/audit-logs",
  },
  attendance: {
    checkIn: "/api/attendance/check-in",
    checkOut: "/api/attendance/check-out",
    records: "/api/attendance/records",
    corrections: "/api/attendance/corrections",
  },
  leave: {
    types: "/api/leave/types",
    balances: "/api/leave/balances",
    requests: "/api/leave/requests",
    approve: (requestId: string) => `/api/leave/requests/${requestId}/approve`,
    reject: (requestId: string) => `/api/leave/requests/${requestId}/reject`,
  },
  payroll: {
    overview: "/api/payroll",
    periodDetail: (periodId: string) => `/api/payroll/periods/${periodId}`,
    myPayslip: "/api/payroll/me/payslip",
  },
  mail: {
    messages: "/api/mail/messages",
    recipients: "/api/mail/recipients",
    send: "/api/mail/messages/send",
    saveDraft: "/api/mail/messages/draft",
    markRead: (messageId: string) => `/api/mail/messages/${messageId}/read`,
    attachments: (messageId: string) => `/api/mail/messages/${messageId}/attachments`,
    attachment: (attachmentId: string) => `/api/mail/attachments/${attachmentId}`,
    downloadAttachment: (attachmentId: string) => `/api/mail/attachments/${attachmentId}/download`,
  },
  messenger: {
    leaveThread: (threadId: string) => `/api/messenger/threads/${threadId}/leave`,
  },
  approvals: {
    forms: "/api/approvals/forms",
    lines: "/api/approvals/lines",
    documents: "/api/approvals/documents",
    detail: (documentId: string) => `/api/approvals/documents/${documentId}`,
    comments: (documentId: string) => `/api/approvals/documents/${documentId}/comments`,
    inbox: "/api/approvals/inbox",
    approve: (documentId: string) => `/api/approvals/documents/${documentId}/approve`,
    reject: (documentId: string) => `/api/approvals/documents/${documentId}/reject`,
    referenceCandidates: "/api/approvals/references/candidates",
    agreementCandidates: "/api/approvals/agreements/candidates",
  },
  boards: {
    notices: "/api/notices",
    boards: "/api/boards",
    posts: (boardId: string) => `/api/boards/${boardId}/posts`,
    postDetail: (postId: string) => `/api/posts/${postId}`,
    comments: (postId: string) => `/api/posts/${postId}/comments`,
  },
  documents: {
    spaces: "/api/documents/spaces",
    files: "/api/documents/files",
    fileMetadata: "/api/documents/files/metadata",
    uploadInit: "/api/documents/files/upload-init",
    uploadComplete: (fileId: string) => `/api/documents/files/${fileId}/upload-complete`,
    downloadInit: (fileId: string) => `/api/documents/files/${fileId}/download-init`,
    downloadFile: (fileId: string) => `/api/documents/files/${fileId}/download`,
    deleteFile: (fileId: string) => `/api/documents/files/${fileId}`,
  },
  electronicContracts: {
    list: "/api/electronic-contracts",
    create: "/api/electronic-contracts",
    detail: (contractId: string) => `/api/electronic-contracts/${contractId}`,
    updateStatus: (contractId: string) => `/api/electronic-contracts/${contractId}/status`,
  },
  erp: {
    vendors: "/api/erp/vendors",
    vendorDetail: (vendorId: string) => `/api/erp/vendors/${vendorId}`,
    vendorStatus: (vendorId: string) => `/api/erp/vendors/${vendorId}/status`,
    expenses: "/api/erp/expenses",
    expenseDetail: (expenseId: string) => `/api/erp/expenses/${expenseId}`,
    expenseStatus: (expenseId: string) => `/api/erp/expenses/${expenseId}/status`,
    evidence: "/api/erp/evidence",
    evidenceDetail: (evidenceId: string) => `/api/erp/evidence/${evidenceId}`,
    evidenceStatus: (evidenceId: string) => `/api/erp/evidence/${evidenceId}/status`,
    billings: "/api/erp/billings",
    billingDetail: (billingId: string) => `/api/erp/billings/${billingId}`,
    billingStatus: (billingId: string) => `/api/erp/billings/${billingId}/status`,
    paymentRecords: "/api/erp/payment-records",
    paymentRecordDetail: (paymentRecordId: string) => `/api/erp/payment-records/${paymentRecordId}`,
    paymentRecordStatus: (paymentRecordId: string) => `/api/erp/payment-records/${paymentRecordId}/status`,
    accountSubjects: "/api/erp/account-subjects",
    journalEntries: "/api/erp/journal-entries",
    journalEntryDetail: (journalEntryId: string) => `/api/erp/journal-entries/${journalEntryId}`,
    journalEntryStatus: (journalEntryId: string) => `/api/erp/journal-entries/${journalEntryId}/status`,
    ledgerEntries: "/api/erp/ledger-entries",
    closingPeriods: "/api/erp/closing-periods",
    closingPeriodDetail: (periodId: string) => `/api/erp/closing-periods/${periodId}`,
    closingPeriodStatus: (periodId: string) => `/api/erp/closing-periods/${periodId}/status`,
    taxDocuments: "/api/erp/tax-documents",
    taxReportPackages: "/api/erp/tax-report-packages",
    accountingMappings: "/api/erp/accounting-mappings",
    accountingMappingDetail: (mappingId: string) => `/api/erp/accounting-mappings/${mappingId}`,
    accountingMappingStatus: (mappingId: string) => `/api/erp/accounting-mappings/${mappingId}/status`,
    integrationEvents: "/api/erp/integration-events",
    integrationEventDetail: (eventId: string) => `/api/erp/integration-events/${eventId}`,
    integrationEventStatus: (eventId: string) => `/api/erp/integration-events/${eventId}/status`,
  },
  vehicleOperationLogs: {
    vehicles: "/api/vehicle-operation/vehicles",
    logs: "/api/vehicle-operation/logs",
    create: "/api/vehicle-operation/logs",
    detail: (logId: string) => `/api/vehicle-operation/logs/${logId}`,
    update: (logId: string) => `/api/vehicle-operation/logs/${logId}`,
    submit: (logId: string) => `/api/vehicle-operation/logs/${logId}/submit`,
    cancel: (logId: string) => `/api/vehicle-operation/logs/${logId}/cancel`,
  },
  workItems: {
    list: "/api/work-items",
    detail: (workItemId: string) => `/api/work-items/${workItemId}`,
    documents: (workItemId: string) => `/api/work-items/${workItemId}/documents`,
    attachments: (workItemId: string) => `/api/work-items/${workItemId}/attachments`,
    reviews: (workItemId: string) => `/api/work-items/${workItemId}/reviews`,
    deadlines: "/api/work-item-deadlines",
  },
  readReceipts: "/api/read-receipts",
} as const;

export const appSections = [
  { href: "/dashboard", label: "대시보드", description: "오늘 처리할 업무와 알림을 모으는 시작 화면" },
  { href: "/attendance", label: "근태", description: "출퇴근 기록과 정정 요청 흐름의 시작점" },
  { href: "/leave", label: "휴가", description: "휴가 잔여와 신청 현황을 다루는 영역" },
  { href: "/payroll", label: "급여", description: "급여 기초자료, 계산 보조, 명세서 초안을 분리해서 보는 영역" },
  { href: "/approvals", label: "전자결재", description: "결재 문서 제출/승인 UI 골격" },
  { href: "/boards", label: "게시판", description: "사내 공지와 게시글 기능 후보" },
  { href: "/documents", label: "문서", description: "R2 기반 첨부/문서 관리 후보 영역" },
  { href: "/sales", label: "영업관리", description: "상담, 거래, 후속 연락 흐름을 확인하는 영업 업무 영역" },
  { href: "/me", label: "내 정보", description: "세션, 역할, 회사 정보와 보안 안내를 확인하는 개인 영역" },
  { href: "/org", label: "조직도", description: "부서/직책 구조를 탐색하는 조직 보기" },
  { href: "/employees", label: "직원", description: "직원 기본정보와 인사 상태를 조회하는 공간" },
  { href: "/admin", label: "관리자", description: "관리자 정책 및 감사 로그 확장 시작점" },
] as const;

const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema,
    error: z.null(),
  });

export const errorCodeSchema = z.enum([
  "AUTH_REQUIRED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "NOT_IMPLEMENTED",
  "DB_NOT_CONFIGURED",
]);

export const errorResponseSchema = z.object({
  ok: z.literal(false),
  data: z.null(),
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const mailBoxSchema = z.enum(["inbox", "sent", "drafts"]);

export const mailRecipientSourceKindSchema = z.enum(["internal", "history"]);

export const mailRecipientSchema = z.object({
  userId: z.string(),
  employeeId: z.string().nullable(),
  displayName: z.string(),
  email: z.string(),
  departmentName: z.string().nullable(),
  positionName: z.string().nullable(),
  sourceKind: mailRecipientSourceKindSchema,
});

export const mailRecipientListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(mailRecipientSchema),
    source: z.literal("postgres"),
  }),
);

export const mailMessageStatusSchema = z.enum(["draft", "sent", "archived"]);
export const mailImportanceSchema = z.enum(["normal", "important"]);

export const mailMessageSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  senderUserId: z.string(),
  senderName: z.string(),
  recipientUserId: z.string().nullable(),
  recipientName: z.string().nullable(),
  subject: z.string(),
  body: z.string(),
  status: mailMessageStatusSchema,
  importance: mailImportanceSchema,
  sentAt: z.string().datetime().nullable(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const mailMessageListResponseSchema = successResponseSchema(
  z.object({
    box: mailBoxSchema,
    items: z.array(mailMessageSchema),
    counts: z.object({
      inbox: z.number().int().nonnegative(),
      unread: z.number().int().nonnegative(),
      sent: z.number().int().nonnegative(),
      drafts: z.number().int().nonnegative(),
    }),
    source: z.literal("postgres"),
  }),
);

export const mailMessageSendRequestSchema = z.object({
  recipientUserId: z.string().min(1).optional(),
  recipientUserIds: z.array(z.string().min(1)).min(1).max(20).optional(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  importance: mailImportanceSchema.default("normal"),
}).refine((value) => Boolean(value.recipientUserId || value.recipientUserIds?.length), {
  message: "recipientUserId or recipientUserIds is required",
  path: ["recipientUserIds"],
});

export const mailMessageDraftSaveRequestSchema = z.object({
  recipientUserId: z.string().min(1).optional(),
  recipientUserIds: z.array(z.string().min(1)).max(20).optional(),
  subject: z.string().max(200).optional(),
  body: z.string().max(10000).optional(),
  importance: mailImportanceSchema.default("normal"),
});

export const mailMessageSendResponseSchema = successResponseSchema(
  z.object({
    message: mailMessageSchema,
    messages: z.array(mailMessageSchema).min(1).optional(),
    audit: z.object({
      candidate: z.literal(true),
      action: z.string(),
    }),
    source: z.literal("postgres"),
  }),
);

export const mailMessageDraftSaveResponseSchema = successResponseSchema(
  z.object({
    message: mailMessageSchema,
    audit: z.object({
      candidate: z.literal(true),
      action: z.string(),
    }),
    source: z.literal("postgres"),
  }),
);

export const mailMessageReadResponseSchema = successResponseSchema(
  z.object({
    message: mailMessageSchema,
    source: z.literal("postgres"),
  }),
);

export const messengerThreadLeaveResponseSchema = successResponseSchema(
  z.object({
    threadId: z.string(),
    left: z.literal(true),
    leftAt: z.string().datetime(),
    source: z.literal("postgres"),
  }),
);

export const mailAttachmentSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  messageId: z.string(),
  fileName: z.string(),
  contentType: z.string(),
  fileSize: z.number().int().nonnegative(),
  objectKeyPreview: z.string(),
  uploadedBy: z.string(),
  uploadedAt: z.string().datetime(),
});

export const mailAttachmentListResponseSchema = successResponseSchema(
  z.object({
    messageId: z.string(),
    items: z.array(mailAttachmentSchema),
    source: z.literal("postgres-r2"),
  }),
);

export const mailAttachmentUploadResponseSchema = successResponseSchema(
  z.object({
    attachment: mailAttachmentSchema,
    audit: z.object({
      candidate: z.literal(true),
      action: z.string(),
    }),
    source: z.literal("postgres-r2"),
  }),
);

export const mailAttachmentDeleteResponseSchema = successResponseSchema(
  z.object({
    attachmentId: z.string(),
    audit: z.object({
      candidate: z.literal(true),
      action: z.string(),
    }),
    source: z.literal("postgres-r2"),
  }),
);

export const roleCodeSchema = z.enum([
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
  "HR_ADMIN",
  "MANAGER",
  "EMPLOYEE",
  "AUDITOR",
]);

export const permissionCodeSchema = z.enum([
  "company.read",
  "employee.read",
  "employee.write",
  "department.read",
  "role.read",
  "permission.read",
  "invite.manage",
  "audit.read",
  "attendance.read",
  "attendance.manage",
  "leave.request",
  "leave.approve",
  "payroll.read",
  "payroll.manage",
  "payroll.review",
  "payroll.payslip.read_self",
  "approval.form.manage",
  "approval.line.manage",
  "approval.document.read",
  "approval.document.write",
  "approval.document.approve",
  "board.notice.read",
  "board.manage",
  "board.post.write",
  "board.comment.write",
  "document.space.read",
  "document.space.manage",
  "document.file.read",
  "document.file.write",
  "work_item.read",
  "work_item.manage",
  "work_item.review",
  "work_item.deadline.read",
  "work_item.audit.read",
  "work_item.grievance.read_restricted",
  "work_item.labor.read_restricted",
]);

export const workItemModuleSchema = z.enum(["hr", "tax", "labor", "legal", "branch"]);
export const workItemStatusSchema = z.enum(["draft", "todo", "in_progress", "waiting_review", "blocked", "done", "archived"]);
export const workItemPrioritySchema = z.enum(["low", "normal", "high", "critical"]);
export const workItemViewerScopeSchema = z.enum(["self", "branch", "company", "company_audit"]);
export const workItemCapabilitySchema = z.enum([
  "work_item.read",
  "work_item.manage",
  "work_item.review",
  "work_item.deadline.read",
  "work_item.audit.read",
  "work_item.attachment.read_sensitive",
  "work_item.grievance.read_restricted",
  "work_item.labor.read_restricted",
]);
export const workItemHrLifecycleStageSchema = z.enum([
  "preboarding",
  "onboarding",
  "probation",
  "active_service",
  "performance_feedback",
  "capability_building",
  "grievance_support",
  "transition_offboarding",
]);
export const workItemScheduleStatusSchema = z.enum(["planned", "confirmed", "completed", "cancelled"]);
export const workItemConfidentialityLevelSchema = z.enum(["standard", "hr_private", "grievance_restricted"]);
export const workItemMeetingModeSchema = z.enum(["in_person", "remote", "hybrid", "tbd"]);
export const workItemLaborIntakeStatusSchema = z.enum(["received", "screening", "evidence_requested", "under_review", "action_planned", "closed"]);
export const workItemLaborConfidentialityLevelSchema = z.enum(["standard", "labor_private", "grievance_restricted", "disciplinary_restricted"]);
export const workItemLaborEvidenceTypeSchema = z.enum([
  "attendance_record",
  "leave_balance",
  "contract_snapshot",
  "allowance_basis",
  "grievance_statement",
  "incident_attachment",
]);
export const workItemLaborReviewScopeSchema = z.enum(["labor_hq", "hr_hq", "branch_manager", "employee", "auditor"]);
export const workItemLaborReviewResponsibilitySchema = z.enum(["screening", "evidence_check", "policy_review", "acknowledgement", "audit_only"]);
export const workItemLaborFollowUpTypeSchema = z.enum([
  "document_request",
  "meeting_request",
  "policy_review",
  "schedule_adjustment",
  "closure_check",
]);
export const workItemTaxFilingStageSchema = z.enum(["collecting", "branch_submitted", "hq_reviewing", "package_ready", "handed_off"]);
export const workItemTaxEvidenceStatusSchema = z.enum(["not_started", "partial", "ready", "missing", "returned"]);
export const workItemTaxDeadlineKindSchema = z.enum(["monthly", "quarterly", "semiannual", "annual"]);
export const workItemTaxExternalFilingStatusSchema = z.enum(["approval_required", "not_connected"]);
export const workItemTaxSensitiveRecordStatusSchema = z.enum(["metadata_only", "upload_gated"]);
export const workItemTaxTypeSchema = z.enum(["vat", "withholding", "local", "corporate"]);
export const workItemTaxEvidenceItemTypeSchema = z.enum([
  "sales_summary",
  "expense_summary",
  "payroll_tax_basis",
  "invoice_register",
  "card_receipt_batch",
  "local_tax_basis",
  "adjustment_note",
  "advisor_cover_note",
]);
export const workItemTaxReviewScopeSchema = z.enum(["tax_hq", "branch_manager", "auditor"]);
export const workItemTaxReviewResponsibilitySchema = z.enum(["submission", "collection_review", "missing_follow_up", "package_preparation", "audit_only"]);
export const workItemLegalIntakeStatusSchema = z.enum(["received", "assigned", "reviewing", "revision_requested", "approved", "completed"]);
export const workItemLegalContractTypeSchema = z.enum(["hotel_management", "lease", "service", "partner", "personal_data_processing"]);
export const workItemLegalRenewalStatusSchema = z.enum(["not_applicable", "upcoming", "under_review", "renewal_decided", "expired_attention"]);
export const workItemLegalDisputeStatusSchema = z.enum(["none", "intake", "fact_check", "response_preparing", "counsel_gate"]);
export const workItemLegalExternalCounselStatusSchema = z.enum(["approval_required", "not_connected"]);
export const workItemLegalSensitiveDocumentStatusSchema = z.enum(["metadata_only", "upload_gated"]);
export const workItemLegalReviewScopeSchema = z.enum(["legal_hq", "operations_hq", "branch_manager", "auditor"]);
export const workItemLegalReviewResponsibilitySchema = z.enum(["intake", "assignment", "review", "revision_follow_up", "approval_gate", "audit_only"]);

export const payrollPayTypeSchema = z.enum(["monthly", "hourly", "daily", "annual", "inclusive"]);
export const payrollPeriodStatusSchema = z.enum(["draft", "collecting", "reviewing", "confirmed", "closed"]);
export const payrollLineItemClassificationSchema = z.enum(["earning", "deduction", "tax_estimate", "insurance_estimate"]);
export const payrollLineItemSourceSchema = z.enum(["manual", "attendance", "policy", "tax_estimate", "insurance_estimate"]);
export const payrollReviewScopeSchema = z.enum(["headquarters_payroll", "branch_manager", "employee", "auditor"]);
export const payrollReviewStatusSchema = z.enum(["pending", "submitted", "reviewing", "changes_requested", "confirmed"]);

export const payrollProfileSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  employeeName: z.string(),
  branchId: z.string().nullable(),
  branchLabel: z.string().nullable(),
  payType: payrollPayTypeSchema,
  basePay: z.number().nonnegative().nullable(),
  hourlyRate: z.number().nonnegative().nullable(),
  dailyRate: z.number().nonnegative().nullable(),
  annualSalary: z.number().nonnegative().nullable(),
  inclusiveAllowance: z.number().nonnegative().nullable(),
  standardWorkHours: z.number().nonnegative(),
  payDay: z.number().int().min(1).max(31),
  effectiveFrom: isoDateSchema,
  effectiveTo: isoDateSchema.nullable(),
  scopeNote: z.string(),
});

export const payrollPeriodSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  title: z.string(),
  branchScopeLabel: z.string(),
  startsOn: isoDateSchema,
  endsOn: isoDateSchema,
  payDate: isoDateSchema,
  status: payrollPeriodStatusSchema,
  sourceSummary: z.string(),
  lockedFieldsNote: z.string(),
});

export const payrollInputSnapshotSchema = z.object({
  id: z.string(),
  periodId: z.string(),
  employeeId: z.string(),
  attendanceHours: z.number().nonnegative(),
  overtimeHours: z.number().nonnegative(),
  nightHours: z.number().nonnegative(),
  holidayHours: z.number().nonnegative(),
  paidLeaveDays: z.number().nonnegative(),
  unpaidLeaveDays: z.number().nonnegative(),
  absenceDays: z.number().nonnegative(),
  latenessCount: z.number().int().nonnegative(),
  earlyLeaveCount: z.number().int().nonnegative(),
  sourceNote: z.string(),
});

export const payrollLineItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: z.string(),
  classification: payrollLineItemClassificationSchema,
  source: payrollLineItemSourceSchema,
  quantity: z.number().nonnegative().nullable(),
  unitAmount: z.number().nonnegative().nullable(),
  premiumRate: z.number().nonnegative().nullable(),
  amount: z.number(),
  note: z.string(),
});

export const payrollReviewStepSchema = z.object({
  id: z.string(),
  periodId: z.string(),
  scope: payrollReviewScopeSchema,
  status: payrollReviewStatusSchema,
  note: z.string(),
});

export const payrollDraftSchema = z.object({
  id: z.string(),
  periodId: z.string(),
  profileId: z.string(),
  employeeId: z.string(),
  employeeName: z.string(),
  branchLabel: z.string().nullable(),
  payType: payrollPayTypeSchema,
  status: payrollPeriodStatusSchema,
  grossPay: z.number().nonnegative(),
  estimatedDeductions: z.number().nonnegative(),
  netPayPreview: z.number().nonnegative(),
  reviewNote: z.string(),
  approvalGate: z.string(),
});

export const payrollRoleGuidanceSchema = z.object({
  headquartersPayroll: z.string(),
  branchManager: z.string(),
  employeeSelf: z.string(),
  auditor: z.string(),
  restrictedActions: z.array(z.string()).min(1),
});

export const payrollOverviewResponseSchema = successResponseSchema(
  z.object({
    profiles: z.array(payrollProfileSchema),
    periods: z.array(payrollPeriodSchema),
    collectionSteps: z.array(payrollReviewStepSchema),
    roleGuidance: payrollRoleGuidanceSchema,
  }),
);

export const payrollPeriodDetailResponseSchema = successResponseSchema(
  z.object({
    period: payrollPeriodSchema,
    draft: payrollDraftSchema,
    inputSnapshot: payrollInputSnapshotSchema,
    lineItems: z.array(payrollLineItemSchema),
    reviewSteps: z.array(payrollReviewStepSchema),
    roleGuidance: payrollRoleGuidanceSchema,
  }),
);

export const payrollMyPayslipResponseSchema = successResponseSchema(
  z.object({
    period: payrollPeriodSchema,
    payslip: payrollDraftSchema,
    lineItems: z.array(payrollLineItemSchema),
    employeeMessage: z.string(),
    correctionRequestGuide: z.string(),
  }),
);

export const workItemAssigneeSchema = z.object({
  userId: z.string().nullable(),
  roleCode: roleCodeSchema.nullable(),
  label: z.string(),
});

export const workItemAccessSchema = z.object({
  companyId: z.string(),
  branchId: z.string().nullable(),
  branchLabel: z.string().nullable(),
  viewerScope: workItemViewerScopeSchema,
  allowedRoleCodes: z.array(roleCodeSchema).min(1),
  capabilities: z.array(workItemCapabilitySchema).min(1),
  branchAccessNote: z.string(),
  roleAccessNote: z.string(),
});

export const workItemHrParticipantSchema = z.object({
  employeeId: z.string().nullable(),
  roleCode: roleCodeSchema.nullable(),
  label: z.string(),
  participationType: z.enum(["subject", "facilitator", "manager", "observer"]),
  canReadPrivateNotes: z.boolean(),
});

export const workItemHrFollowUpSchema = z.object({
  required: z.boolean(),
  summary: z.string(),
  ownerRoleCodes: z.array(roleCodeSchema),
  nextActionPreview: z.string(),
});

export const workItemHrVisibilitySchema = z.object({
  headquartersHr: z.string(),
  branchManager: z.string(),
  employeeSelf: z.string(),
  participantAccessNote: z.string(),
});

export const workItemHrContextSchema = z.object({
  lifecycleStage: workItemHrLifecycleStageSchema,
  scheduleStatus: workItemScheduleStatusSchema,
  meetingMode: workItemMeetingModeSchema,
  confidentialityLevel: workItemConfidentialityLevelSchema,
  notesPreview: z.string(),
  privateNoteExists: z.boolean(),
  externalSyncStatus: z.literal("approval_required"),
  sensitiveRecordStatus: z.literal("metadata_only"),
  participants: z.array(workItemHrParticipantSchema).min(1),
  agendaItems: z.array(z.string()).min(1),
  followUp: workItemHrFollowUpSchema,
  visibility: workItemHrVisibilitySchema,
});

export const workItemLaborEvidenceSummarySchema = z.object({
  type: workItemLaborEvidenceTypeSchema,
  summary: z.string(),
  submittedByScope: workItemLaborReviewScopeSchema,
  submittedAt: z.string().datetime(),
  containsSensitiveData: z.boolean(),
});

export const workItemLaborReviewActorSchema = z.object({
  scope: workItemLaborReviewScopeSchema,
  roleCode: roleCodeSchema.nullable(),
  responsibility: workItemLaborReviewResponsibilitySchema,
  status: z.string(),
});

export const workItemLaborFollowUpSchema = z.object({
  required: z.boolean(),
  type: workItemLaborFollowUpTypeSchema,
  ownerScope: workItemLaborReviewScopeSchema,
  dueAt: z.string().datetime().nullable(),
  linkedWorkItemId: z.string().nullable(),
  summary: z.string(),
});

export const workItemLaborVisibilitySchema = z.object({
  laborHeadquarters: z.string(),
  headquartersHr: z.string(),
  branchManager: z.string(),
  employeeSelf: z.string(),
  auditor: z.string(),
  restrictedNote: z.string(),
});

export const workItemLaborContextSchema = z.object({
  intakeStatus: workItemLaborIntakeStatusSchema,
  confidentialityLevel: workItemLaborConfidentialityLevelSchema,
  requiresAcknowledgement: z.boolean(),
  legalHoldRequired: z.boolean(),
  externalAdvisoryStatus: z.literal("approval_required"),
  sensitiveRecordStatus: z.literal("metadata_only"),
  evidenceSummary: z.array(workItemLaborEvidenceSummarySchema).min(1),
  reviewActors: z.array(workItemLaborReviewActorSchema).min(1),
  followUp: workItemLaborFollowUpSchema,
  visibility: workItemLaborVisibilitySchema,
  auditHints: z.array(z.string()).min(1),
});

export const workItemTaxBranchRequestSchema = z.object({
  branchId: z.string(),
  branchLabel: z.string(),
  submissionStatus: workItemTaxEvidenceStatusSchema,
  requestedAt: z.string().datetime(),
  submittedAt: z.string().datetime().nullable(),
  dueAt: z.string().datetime(),
  missingEvidenceCount: z.number().int().nonnegative(),
  note: z.string(),
});

export const workItemTaxEvidenceSummarySchema = z.object({
  type: workItemTaxEvidenceItemTypeSchema,
  summary: z.string(),
  status: workItemTaxEvidenceStatusSchema,
  branchLabel: z.string().nullable(),
  containsSensitiveData: z.boolean(),
});

export const workItemTaxReviewActorSchema = z.object({
  scope: workItemTaxReviewScopeSchema,
  roleCode: roleCodeSchema.nullable(),
  responsibility: workItemTaxReviewResponsibilitySchema,
  status: z.string(),
});

export const workItemTaxPackagePreparationSchema = z.object({
  status: z.enum(["not_started", "collecting", "ready_for_review", "ready_to_hand_off"]),
  plannedContents: z.array(z.string()).min(1),
  summary: z.string(),
  deliveryGate: z.string(),
});

export const workItemTaxVisibilitySchema = z.object({
  headquartersTax: z.string(),
  branchManager: z.string(),
  auditor: z.string(),
  generalEmployee: z.string(),
  restrictedNote: z.string(),
});

export const workItemTaxContextSchema = z.object({
  taxType: workItemTaxTypeSchema,
  filingStage: workItemTaxFilingStageSchema,
  evidenceStatus: workItemTaxEvidenceStatusSchema,
  deadlineKind: workItemTaxDeadlineKindSchema,
  reportingPeriodLabel: z.string(),
  externalFilingStatus: workItemTaxExternalFilingStatusSchema,
  sensitiveRecordStatus: workItemTaxSensitiveRecordStatusSchema,
  branchRequests: z.array(workItemTaxBranchRequestSchema).min(1),
  evidenceSummary: z.array(workItemTaxEvidenceSummarySchema).min(1),
  reviewActors: z.array(workItemTaxReviewActorSchema).min(1),
  packagePreparation: workItemTaxPackagePreparationSchema,
  visibility: workItemTaxVisibilitySchema,
  auditHints: z.array(z.string()).min(1),
});

export const workItemLegalRelatedBranchRequestSchema = z.object({
  branchId: z.string(),
  branchLabel: z.string(),
  requestStatus: workItemLegalIntakeStatusSchema,
  requestedAt: z.string().datetime(),
  note: z.string(),
});

export const workItemLegalDocumentSummarySchema = z.object({
  type: z.enum(["contract_summary", "renewal_note", "dispute_note", "claim_note", "insurance_note", "incident_note"]),
  title: z.string(),
  summary: z.string(),
  containsSensitiveData: z.boolean(),
});

export const workItemLegalReviewActorSchema = z.object({
  scope: workItemLegalReviewScopeSchema,
  roleCode: roleCodeSchema.nullable(),
  responsibility: workItemLegalReviewResponsibilitySchema,
  status: z.string(),
});

export const workItemLegalApprovalGateSchema = z.object({
  required: z.boolean(),
  stage: z.enum(["internal_review", "executive_approval", "external_counsel"]),
  summary: z.string(),
  externalActionBlocked: z.boolean(),
});

export const workItemLegalVisibilitySchema = z.object({
  headquartersLegalOperations: z.string(),
  branchManager: z.string(),
  auditor: z.string(),
  generalEmployee: z.string(),
  restrictedNote: z.string(),
});

export const workItemLegalContextSchema = z.object({
  intakeStatus: workItemLegalIntakeStatusSchema,
  contractType: workItemLegalContractTypeSchema,
  renewalStatus: workItemLegalRenewalStatusSchema,
  renewalDueAt: z.string().datetime().nullable(),
  disputeStatus: workItemLegalDisputeStatusSchema,
  externalCounselStatus: workItemLegalExternalCounselStatusSchema,
  sensitiveDocumentStatus: workItemLegalSensitiveDocumentStatusSchema,
  relatedBranchRequests: z.array(workItemLegalRelatedBranchRequestSchema),
  documentSummary: z.array(workItemLegalDocumentSummarySchema).min(1),
  reviewActors: z.array(workItemLegalReviewActorSchema).min(1),
  approvalGate: workItemLegalApprovalGateSchema,
  visibility: workItemLegalVisibilitySchema,
  auditHints: z.array(z.string()).min(1),
});

export const workItemSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  branchId: z.string().nullable(),
  branchLabel: z.string().nullable(),
  module: workItemModuleSchema,
  category: z.string(),
  title: z.string(),
  descriptionPreview: z.string(),
  status: workItemStatusSchema,
  priority: workItemPrioritySchema,
  assignee: workItemAssigneeSchema,
  requesterUserId: z.string().nullable(),
  dueAt: z.string().datetime().nullable(),
  reviewRequired: z.boolean(),
  containsSensitiveData: z.boolean(),
  access: workItemAccessSchema,
  hrContext: workItemHrContextSchema.nullable(),
  laborContext: workItemLaborContextSchema.nullable(),
  taxContext: workItemTaxContextSchema.nullable().optional(),
  legalContext: workItemLegalContextSchema.nullable().optional(),
  tags: z.array(z.string()),
  auditSummary: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
});
export const workItemDocumentSchema = z.object({
  id: z.string(),
  workItemId: z.string(),
  documentType: z.string(),
  title: z.string(),
  status: z.enum(["draft", "requested", "received", "review_ready"]),
  visibility: z.enum(["branch", "company", "restricted"]),
  containsSensitiveData: z.boolean(),
  accessNote: z.string(),
  updatedAt: z.string().datetime(),
});

export const workItemAttachmentSchema = z.object({
  id: z.string(),
  workItemId: z.string(),
  fileName: z.string(),
  category: z.string(),
  uploadedBy: z.string(),
  uploadedAt: z.string().datetime(),
  sensitivityLabel: z.enum(["general", "internal", "restricted"]),
  storageExposure: z.literal("metadata_only"),
  contentAvailable: z.literal(false),
});

export const workItemReviewSchema = z.object({
  id: z.string(),
  workItemId: z.string(),
  reviewerRoleCode: roleCodeSchema,
  decision: z.enum(["approved", "changes_requested", "rejected", "noted"]),
  summary: z.string(),
  reviewedAt: z.string().datetime(),
});

export const workItemDeadlineSchema = z.object({
  id: z.string(),
  workItemId: z.string(),
  title: z.string(),
  dueAt: z.string().datetime(),
  status: z.enum(["scheduled", "upcoming", "due_today", "overdue", "done"]),
  ownerScope: z.string(),
  escalationNote: z.string(),
});

export const workItemAuditLogSchema = z.object({
  id: z.string(),
  workItemId: z.string(),
  action: z.string(),
  actorRoleCode: roleCodeSchema,
  summary: z.string(),
  happenedAt: z.string().datetime(),
});

export const healthPayloadSchema = z.object({
  service: z.literal("gw-api"),
  status: z.literal("ok"),
  version: z.literal("0.1.0"),
});

export const healthResponseSchema = successResponseSchema(healthPayloadSchema);

export const sessionSchema = z.object({
  id: z.string(),
  status: z.enum(["authenticated", "signed_out"]),
  expiresAt: z.string().datetime(),
});

export const sessionUserSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  email: z.email(),
  fullName: z.string(),
  roleCodes: z.array(roleCodeSchema).min(1),
  permissions: z.array(permissionCodeSchema),
});

export const authLoginRequestSchema = z
  .object({
    loginId: z.string().trim().min(1).optional(),
    email: z.email().optional(),
    password: z.string().min(4),
    rememberSession: z.boolean().optional(),
    roleCode: roleCodeSchema.optional(),
  })
  .refine((value) => Boolean(value.loginId || value.email), {
    message: "loginId or email is required",
    path: ["loginId"],
  });

export const authLoginResponseSchema = successResponseSchema(
  z.object({
    session: sessionSchema,
    user: sessionUserSchema,
    nextStep: z.string(),
  }),
);

export const authLogoutResponseSchema = successResponseSchema(
  z.object({
    session: z.object({
      status: z.literal("signed_out"),
    }),
  }),
);

export const meResponseSchema = successResponseSchema(
  z.object({
    session: sessionSchema,
    user: sessionUserSchema,
  }),
);

export const secondaryPasswordStatusResponseSchema = successResponseSchema(
  z.object({
    hasSecondaryPassword: z.boolean(),
    persistence: z.literal("operational-db"),
    updatedAt: z.string().datetime().nullable(),
  }),
);

export const secondaryPasswordUpdateRequestSchema = z.object({
  currentPin: z.string().regex(/^\d{4}$/).optional(),
  nextPin: z.string().regex(/^\d{4}$/),
  confirmPin: z.string().regex(/^\d{4}$/),
});

export const secondaryPasswordUpdateResponseSchema = successResponseSchema(
  z.object({
    hasSecondaryPassword: z.literal(true),
    persistence: z.literal("operational-db"),
    updatedAt: z.string().datetime(),
  }),
);

export const secondaryPasswordVerifyRequestSchema = z.object({
  pin: z.string().regex(/^\d{4}$/),
});

export const secondaryPasswordVerifyResponseSchema = successResponseSchema(
  z.object({
    verified: z.literal(true),
    persistence: z.literal("operational-db"),
  }),
);



export const userPreferencesSchema = z.record(z.string(), z.unknown());

export const userPreferencesResponseSchema = successResponseSchema(
  z.object({
    preferences: userPreferencesSchema,
    persistence: z.literal("operational-db"),
    updatedAt: z.string().datetime().nullable(),
  }),
);

export const userPreferencesUpdateRequestSchema = z.object({
  preferences: userPreferencesSchema,
});

export const userPreferencesUpdateResponseSchema = successResponseSchema(
  z.object({
    preferences: userPreferencesSchema,
    persistence: z.literal("operational-db"),
    updatedAt: z.string().datetime(),
  }),
);

export const adminPermissionUserIdSchema = z.enum(["admin", "hr_manager", "branch_manager", "employee"]);
export const adminFeaturePermissionKeySchema = z.enum(["attendance", "leave", "approvals", "boards", "documents", "employees", "payroll", "management"]);
export const adminPermissionStateSchema = z.record(
  adminPermissionUserIdSchema,
  z.record(adminFeaturePermissionKeySchema, z.boolean()),
);

export const adminPermissionSettingsResponseSchema = successResponseSchema(
  z.object({
    settings: adminPermissionStateSchema,
    persistence: z.literal("operational-db"),
    updatedAt: z.string().datetime().nullable(),
  }),
);

export const adminPermissionSettingsUpdateRequestSchema = z.object({
  settings: adminPermissionStateSchema,
});

export const adminPermissionSettingsUpdateResponseSchema = successResponseSchema(
  z.object({
    settings: adminPermissionStateSchema,
    persistence: z.literal("operational-db"),
    updatedAt: z.string().datetime(),
  }),
);

export const companySettingsGroupIdSchema = z.enum([
  "company_profile",
  "organization_people_access",
  "attendance_leave_work_policies",
  "admin_operations",
]);

export const companySettingsGroupSchema = z.object({
  id: companySettingsGroupIdSchema,
  title: z.string(),
  summary: z.string(),
  owner: z.string(),
  linkedRoutes: z.array(z.string()).min(1),
});

export const companyPolicyAxisSchema = z.object({
  id: z.enum(["attendance_registration", "leave_work_policy", "employee_policy_visibility"]),
  title: z.string(),
  summary: z.string(),
  priority: z.string(),
});

export const companyApprovalGateStatusSchema = z.enum(["ready", "approval_required"]);

export const companyApprovalGateSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: companyApprovalGateStatusSchema,
  summary: z.string(),
});

export const companySettingsModelSchema = z.object({
  companyId: z.string(),
  companyName: z.string(),
  policyStartPoint: z.string(),
  groups: z.array(companySettingsGroupSchema).length(4),
  policyAxes: z.array(companyPolicyAxisSchema).min(3),
  employeeVisibilityRules: z.array(z.string()).min(3),
  approvalGates: z.array(companyApprovalGateSchema).min(4),
});

export const companySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  status: z.enum(["active", "inactive"]),
  settingsModel: companySettingsModelSchema,
});

export const employeeSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  departmentId: z.string(),
  email: z.email(),
  fullName: z.string(),
  employmentStatus: z.enum(["active", "on_leave", "offboarded"]),
});

export const employeeDirectorySummarySchema = z.object({
  employeeId: z.string(),
  departmentName: z.string(),
  roleSummary: z.string(),
  statusLabel: z.string(),
  statusTone: z.enum(["positive", "caution", "muted"]),
  primaryNote: z.string(),
});

export const employeeDirectoryFiltersSchema = z.object({
  departmentId: z.string().optional(),
  employmentStatus: employeeSchema.shape.employmentStatus.optional(),
  roleCode: roleCodeSchema.optional(),
});

export const employeeDirectoryFilterOptionsSchema = z.object({
  departments: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    )
    .min(1),
  employmentStatuses: z.array(employeeSchema.shape.employmentStatus).min(1),
  roleCodes: z.array(roleCodeSchema).min(1),
});

export const departmentSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  parentDepartmentId: z.string().nullable(),
  code: z.string(),
  name: z.string(),
  status: z.enum(["active", "inactive"]),
});

export const permissionSchema = z.object({
  code: permissionCodeSchema,
  description: z.string(),
});

export const homeShortcutSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: z.string(),
  href: z.string(),
  icon: z.string().nullable(),
  isFixed: z.boolean(),
  sortOrder: z.number().int(),
  scope: z.enum(["company", "user"]),
});

export const roleSchema = z.object({
  code: roleCodeSchema,
  name: z.string(),
  scope: z.enum(["global", "company", "audit"]),
  permissions: z.array(permissionCodeSchema),
});

export const branchViewerScopeSchema = z.enum(["hq_admin", "branch_manager", "employee"]);

export const branchSummarySchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  name: z.string(),
  branchType: z.string(),
  status: z.enum(["active", "inactive"]),
});

export const notificationStatusSchema = z.enum(["unread", "read"]);

export const notificationSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  userId: z.string(),
  title: z.string(),
  body: z.string(),
  notificationType: z.string(),
  status: notificationStatusSchema,
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const orgDirectorySectionSummarySchema = z.object({
  title: z.string(),
  description: z.string(),
  count: z.number().int().nonnegative(),
});

export const listCompaniesResponseSchema = successResponseSchema(
  z.object({
    items: z.array(companySchema),
  }),
);

export const listEmployeesResponseSchema = successResponseSchema(
  z.object({
    items: z.array(employeeSchema),
    summaries: z.array(employeeDirectorySummarySchema),
    filters: employeeDirectoryFiltersSchema,
    filterOptions: employeeDirectoryFilterOptionsSchema,
    notices: z.array(z.string()).min(1),
  }),
);

export const listDepartmentsResponseSchema = successResponseSchema(
  z.object({
    items: z.array(departmentSchema),
    summary: orgDirectorySectionSummarySchema,
    notices: z.array(z.string()).min(1),
  }),
);

export const listRolesResponseSchema = successResponseSchema(
  z.object({
    items: z.array(roleSchema),
    summary: orgDirectorySectionSummarySchema,
    notices: z.array(z.string()).min(1),
  }),
);

export const listPermissionsResponseSchema = successResponseSchema(
  z.object({
    items: z.array(permissionSchema),
  }),
);

export const listBranchesResponseSchema = successResponseSchema(
  z.object({
    items: z.array(branchSummarySchema),
    scope: branchViewerScopeSchema,
    summary: orgDirectorySectionSummarySchema,
    notices: z.array(z.string()).min(1),
  }),
);

export const listHomeShortcutsResponseSchema = successResponseSchema(
  z.object({
    items: z.array(homeShortcutSchema),
    notices: z.array(z.string()).min(1),
  }),
);

export const createInviteRequestSchema = z.object({
  companyId: z.string(),
  email: z.email(),
  roleCode: roleCodeSchema,
  departmentId: z.string().optional(),
});

export const auditCandidateSchema = z.object({
  candidate: z.literal(true),
  action: z.string(),
});

export const operationalBlockReasonCategorySchema = z.enum(["permission", "company_scope", "policy", "implementation"]);

export const operationalBridgeItemSchema = z.object({
  category: operationalBlockReasonCategorySchema,
  source: z.string(),
  title: z.string(),
  description: z.string(),
});

export const operationalBridgeSummarySchema = z.object({
  currentState: z.string(),
  sourceLabel: z.string(),
  auditTrailHint: z.string(),
  operationalNote: z.string(),
  blockedReasons: z.array(operationalBridgeItemSchema).min(1),
});

export const listNotificationsResponseSchema = successResponseSchema(
  z.object({
    items: z.array(notificationSchema),
    unreadCount: z.number().int().nonnegative(),
    notices: z.array(z.string()).min(1),
  }),
);

export const leavePolicySummarySchema = z.object({
  effectiveScopeLabel: z.string(),
  allowedLeaveTypeCodes: z.array(z.string()).min(1),
  approvalRequiredTypeCodes: z.array(z.string()).min(1),
  approvalQueueVisibleToCurrentUser: z.boolean(),
  employeeMessage: z.string(),
  managerMessage: z.string(),
});

export const createInviteResponseSchema = successResponseSchema(
  z.object({
    id: z.string(),
    companyId: z.string(),
    email: z.email(),
    roleCode: roleCodeSchema,
    departmentId: z.string().nullable(),
    status: z.enum(["pending_delivery", "accepted", "expired", "cancelled"]),
    expiresAt: z.string().datetime(),
    audit: auditCandidateSchema,
  }),
);

export const adminScopeSchema = z.enum(["global", "company", "audit"]);
export const adminEmployeeLinkStatusSchema = z.enum(["linked", "unlinked", "review_required"]);
export const adminUserStatusChangePreviewSchema = z.object({
  currentStatus: employeeSchema.shape.employmentStatus,
  nextStatus: employeeSchema.shape.employmentStatus,
  reasonRequired: z.literal(true),
});
export const adminUserRoleChangePreviewSchema = z.object({
  currentRoleCodes: z.array(roleCodeSchema).min(1),
  nextRoleCodes: z.array(roleCodeSchema).min(1),
  auditCandidate: z.literal(true),
});
export const adminUserSummarySchema = z.object({
  userId: z.string(),
  employeeId: z.string(),
  companyId: z.string(),
  fullName: z.string(),
  email: z.email(),
  departmentName: z.string(),
  roleCodes: z.array(roleCodeSchema).min(1),
  permissions: z.array(permissionCodeSchema),
  employmentStatus: employeeSchema.shape.employmentStatus,
  adminScope: adminScopeSchema,
  employeeLinkStatus: adminEmployeeLinkStatusSchema,
  highRiskPermissions: z.array(permissionCodeSchema),
  statusChangePreview: adminUserStatusChangePreviewSchema,
  roleChangePreview: adminUserRoleChangePreviewSchema,
});

export const adminUsersListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(adminUserSummarySchema),
    linkedScreens: z.array(operationalBridgeItemSchema).min(1),
    companySettingsModel: companySettingsModelSchema,
    audit: auditCandidateSchema,
  }),
);

export const adminPolicyCategorySchema = z.enum(["company", "attendance", "leave", "approval", "document", "board"]);
export const adminPolicyVisibilitySchema = z.enum(["private", "team", "company"]);
export const attendanceRegistrationMethodSchema = z.enum(["mobile", "pc", "tag"]);
export const attendanceRegistrationTagDeviceStatusSchema = z.enum(["not_configured", "approval_required", "ready_for_device"]);

export const allowedAttendanceRegistrationMethodsSchema = z
  .array(attendanceRegistrationMethodSchema)
  .min(1)
  .refine((methods) => new Set(methods).size === methods.length, {
    message: "attendance registration methods must be unique",
  });

export const attendanceRegistrationPolicySchema = z.object({
  allowedAttendanceRegistrationMethods: allowedAttendanceRegistrationMethodsSchema,
  candidateAllowedAttendanceRegistrationMethods: allowedAttendanceRegistrationMethodsSchema,
  tagDeviceStatus: attendanceRegistrationTagDeviceStatusSchema,
});

export const attendancePolicyLevelSchema = z.enum(["company_default", "workplace", "department", "job_type"]);

export const attendancePolicyRuleSchema = attendanceRegistrationPolicySchema.extend({
  policyLevel: attendancePolicyLevelSchema,
  policyTargetId: z.string(),
  policyTargetLabel: z.string(),
  priorityRank: z.number().int().min(0),
});

export const attendancePolicyAssignmentSchema = attendancePolicyRuleSchema.extend({
  id: z.string(),
  companyId: z.string(),
  active: z.boolean(),
});

export const effectiveAttendancePolicySchema = z.object({
  employeeId: z.string(),
  effectiveAttendanceRegistrationMethods: allowedAttendanceRegistrationMethodsSchema,
  effectiveAttendancePolicy: attendancePolicyRuleSchema,
  effectivePolicySource: attendancePolicyAssignmentSchema,
  matchedAttendancePolicies: z.array(attendancePolicyAssignmentSchema),
  summary: z.string(),
});

export const attendancePolicyScopeSummarySchema = attendancePolicyAssignmentSchema.extend({
  appliedEmployeeCount: z.number().int().min(0),
});

export const attendancePolicyReviewSchema = z.object({
  priorityOrder: z.array(attendancePolicyLevelSchema).length(4),
  scopeSummaries: z.array(attendancePolicyScopeSummarySchema),
  policySubjectSummaries: z.array(effectiveAttendancePolicySchema),
  duplicateWarnings: z.array(z.string()),
});

export const adminPolicySummarySchema = z.object({
  category: adminPolicyCategorySchema,
  companyId: z.string(),
  summary: z.string(),
  lastReviewedAt: z.string().datetime(),
  policyChecks: z.array(z.string()).min(1),
  capability: permissionCodeSchema,
  reasonRequired: z.literal(true),
  diffSummary: z.object({
    before: z.string(),
    after: z.string(),
  }),
  attendanceRegistrationPolicy: attendanceRegistrationPolicySchema.optional(),
  attendancePolicyReview: attendancePolicyReviewSchema.optional(),
  leavePolicySummary: leavePolicySummarySchema.optional(),
});

export const adminPoliciesListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(adminPolicySummarySchema),
    bridgeSummary: operationalBridgeSummarySchema,
    companySettingsModel: companySettingsModelSchema,
    audit: auditCandidateSchema,
  }),
);

export const adminPolicyDocumentUpdateRequestSchema = z.object({
  companyId: z.string(),
  visibility: adminPolicyVisibilitySchema,
  maxFileSizeBytes: z.number().int().positive(),
  allowedFileExtensions: z.array(z.string().min(1)).min(1),
  retentionDays: z.number().int().positive(),
  reason: z.string().min(1),
});

export const adminPolicyBoardUpdateRequestSchema = z
  .object({
    companyId: z.string(),
    visibility: adminPolicyVisibilitySchema,
    allowAnonymousComments: z.boolean(),
    requireReadReceipt: z.boolean(),
    retentionDays: z.number().int().positive(),
    reason: z.string().min(1),
  })
  .strict();

export const adminPolicyUpdateResponseSchema = successResponseSchema(
  z.object({
    policy: adminPolicySummarySchema,
    audit: auditCandidateSchema,
    maskedFields: z.array(z.string()).min(1),
    requiresReview: z.literal(true),
  }),
);

export const adminAuditCategorySchema = z.enum(["user", "permission", "policy", "document_space", "document_file", "electronic_contract", "vehicle_operation_log", "board", "audit"]);
export const adminAuditSourceSchema = z.enum(["web-admin", "api-admin", "system"]);
export const adminAuditStorageStatusSchema = z.enum(["pending", "linked", "failed", "deleted"]);
export const adminAuditMetadataSchema = z.object({
  category: adminAuditCategorySchema,
  reason: z.string(),
  before: z.string(),
  after: z.string(),
  maskedFields: z.array(z.string()).min(1),
  companyBoundary: z.object({
    enforced: z.literal(true),
  }),
  source: adminAuditSourceSchema,
  storageRef: z
    .object({
      fileId: z.string(),
      spaceId: z.string(),
      versionId: z.string(),
      storageStatus: adminAuditStorageStatusSchema,
    })
    .optional(),
  sensitiveMasked: z.literal(true),
});

export const adminAuditTargetTypeSchema = z.enum([
  "user",
  "role_assignment",
  "policy_documents",
  "policy_boards",
  "document_space",
  "document_file",
  "document_policy",
  "board_policy",
  "audit_log",
]);

export const adminAuditLogSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  actorUserId: z.string(),
  actorEmployeeId: z.string(),
  action: z.string(),
  targetType: adminAuditTargetTypeSchema,
  targetId: z.string(),
  createdAt: z.string().datetime(),
  metadata: adminAuditMetadataSchema,
});

export const adminAuditLogFiltersSchema = z.object({
  actorUserId: z.string().optional(),
  actionPrefix: z.string().optional(),
  targetType: adminAuditTargetTypeSchema.optional(),
  category: adminAuditCategorySchema.optional(),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
});

export const adminAuditLogFilterOptionsSchema = z.object({
  actorUserIds: z.array(z.string()).min(1),
  actions: z.array(z.string()).min(1),
  targetTypes: z.array(adminAuditTargetTypeSchema).min(1),
  categories: z.array(adminAuditCategorySchema).min(1),
});

export const adminAuditLogDetailSummarySchema = z.object({
  actorLabel: z.string(),
  targetLabel: z.string(),
  reasonRequired: z.literal(true),
});

export const adminAuditLogListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(adminAuditLogSchema),
    filters: adminAuditLogFiltersSchema,
    filterOptions: adminAuditLogFilterOptionsSchema,
    detailSummary: adminAuditLogDetailSummarySchema,
    operationalTrail: operationalBridgeSummarySchema,
  }),
);

export const attendanceRecordStatusSchema = z.enum(["checked_in", "checked_out", "needs_correction"]);
export const attendanceSourceSchema = z.enum(["web", "mobile", "admin", "import"]);
export const attendanceActionRequestSchema = z.object({
  attendanceRegistrationMethod: attendanceRegistrationMethodSchema,
});

export const attendanceRecordSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  status: attendanceRecordStatusSchema,
  workDate: isoDateSchema,
  checkInAt: z.string().datetime().nullable(),
  checkOutAt: z.string().datetime().nullable(),
  source: attendanceSourceSchema,
  note: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const attendanceActionResponseSchema = successResponseSchema(
  z.object({
    record: attendanceRecordSchema,
    audit: auditCandidateSchema,
  }),
);

export const attendanceListFiltersSchema = z.object({
  employeeId: z.string().optional(),
  workDateFrom: isoDateSchema.optional(),
  workDateTo: isoDateSchema.optional(),
});

export const attendanceListRecordsResponseSchema = successResponseSchema(
  z.object({
    items: z.array(attendanceRecordSchema),
    filters: attendanceListFiltersSchema,
  }),
);

export const attendanceCorrectionRequestSchema = z.object({
  attendanceRecordId: z.string(),
  reason: z.string().min(1),
  requestedCheckInAt: z.string().datetime().optional(),
  requestedCheckOutAt: z.string().datetime().optional(),
  note: z.string().optional(),
});

export const attendanceCorrectionStatusSchema = z.enum(["requested", "approved", "rejected"]);

export const attendanceCorrectionSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  attendanceRecordId: z.string(),
  status: attendanceCorrectionStatusSchema,
  requestedBy: z.string(),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  reason: z.string(),
  requestedCheckInAt: z.string().datetime().nullable(),
  requestedCheckOutAt: z.string().datetime().nullable(),
  note: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const attendanceCorrectionResponseSchema = successResponseSchema(
  z.object({
    request: attendanceCorrectionSchema,
    audit: auditCandidateSchema,
  }),
);

export const leaveUnitSchema = z.enum(["day", "half_day", "hour"]);
export const leaveTypeStatusSchema = z.enum(["active", "inactive"]);
export const leaveRequestStatusSchema = z.enum(["pending_approval", "approved", "rejected", "cancelled"]);
export const leaveApprovalStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const leaveTypeSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  name: z.string(),
  unit: leaveUnitSchema,
  status: leaveTypeStatusSchema,
});

export const leaveBalanceSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  leaveTypeId: z.string(),
  asOfDate: isoDateSchema,
  openingDays: z.number(),
  usedDays: z.number(),
  reservedDays: z.number(),
  remainingDays: z.number(),
});

export const leaveRequestSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  leaveTypeId: z.string(),
  status: leaveRequestStatusSchema,
  approvalStatus: leaveApprovalStatusSchema,
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  unit: leaveUnitSchema,
  days: z.number(),
  reason: z.string(),
  requestedBy: z.string(),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const leaveTypeListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(leaveTypeSchema),
  }),
);

export const leaveBalanceListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(leaveBalanceSchema),
  }),
);

export const leaveRequestListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(leaveRequestSchema),
  }),
);

export const leaveRequestCreateRequestSchema = z.object({
  leaveTypeId: z.string(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  unit: leaveUnitSchema,
  days: z.number().positive(),
  reason: z.string().min(1),
});

const leaveMutationResponseDataSchema = z.object({
  request: leaveRequestSchema,
  audit: auditCandidateSchema,
});

export const leaveRequestCreateResponseSchema = successResponseSchema(leaveMutationResponseDataSchema);

export const leaveActionRequestSchema = z.object({
  reason: z.string().min(1),
});

export const leaveActionResponseSchema = successResponseSchema(leaveMutationResponseDataSchema);

export const approvalFormStatusSchema = z.enum(["active", "inactive"]);
export const approvalDocumentStatusSchema = z.enum(["draft", "pending_approval", "approved", "rejected", "cancelled"]);
export const approvalStepTypeSchema = z.enum(["approve", "agreement"]);
export const approvalDecisionStatusSchema = z.enum(["pending", "approved", "rejected", "skipped"]);
export const approvalReferenceTypeSchema = z.enum(["reference", "agreement"]);

export const approvalFormSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  title: z.string(),
  category: z.string(),
  fieldSummary: z.string(),
  status: approvalFormStatusSchema,
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const approvalStepSchema = z.object({
  id: z.string(),
  documentId: z.string().nullable(),
  lineId: z.string().nullable(),
  stepOrder: z.number().int().positive(),
  approverEmployeeId: z.string(),
  stepType: approvalStepTypeSchema,
  decisionStatus: approvalDecisionStatusSchema,
  decidedAt: z.string().datetime().nullable(),
  decisionComment: z.string().nullable(),
});

export const approvalLineSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  title: z.string(),
  description: z.string(),
  status: approvalFormStatusSchema,
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  steps: z.array(approvalStepSchema),
});

export const approvalDocumentSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  formId: z.string(),
  lineId: z.string(),
  drafterEmployeeId: z.string(),
  title: z.string(),
  summary: z.string(),
  documentNumber: z.string(),
  status: approvalDocumentStatusSchema,
  submittedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const approvalReferenceSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  employeeId: z.string(),
  referenceType: approvalReferenceTypeSchema,
  readAt: z.string().datetime().nullable(),
});

export const approvalCommentSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  documentId: z.string(),
  authorEmployeeId: z.string(),
  body: z.string(),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const approvalHistoryEventTypeSchema = z.enum([
  "submitted",
  "commented",
  "step_pending",
  "approved",
  "rejected",
  "completed",
]);

export const approvalHistoryItemSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  eventType: approvalHistoryEventTypeSchema,
  actorEmployeeId: z.string().nullable(),
  message: z.string(),
  createdAt: z.string().datetime(),
});

export const approvalCandidateSchema = z.object({
  employeeId: z.string(),
  companyId: z.string(),
  fullName: z.string(),
  departmentId: z.string(),
  type: approvalReferenceTypeSchema,
});

export const approvalFormListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(approvalFormSchema),
  }),
);

export const approvalFormCreateRequestSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  fieldSummary: z.string().min(1),
});

export const approvalFormCreateResponseSchema = successResponseSchema(
  z.object({
    form: approvalFormSchema,
    audit: auditCandidateSchema,
  }),
);

export const approvalLineStepCreateSchema = z.object({
  stepOrder: z.number().int().positive(),
  approverEmployeeId: z.string().min(1),
  stepType: approvalStepTypeSchema,
});

export const approvalLineCreateRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  steps: z.array(approvalLineStepCreateSchema).min(1),
});

export const approvalLineListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(approvalLineSchema),
  }),
);

export const approvalLineCreateResponseSchema = successResponseSchema(
  z.object({
    line: approvalLineSchema,
    audit: auditCandidateSchema,
  }),
);

export const approvalDocumentCreateRequestSchema = z.object({
  formId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  lineId: z.string().min(1),
  referenceEmployeeIds: z.array(z.string()).default([]),
  agreementEmployeeIds: z.array(z.string()).default([]),
});

export const approvalDocumentListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(approvalDocumentSchema),
  }),
);

export const approvalDocumentCreateResponseSchema = successResponseSchema(
  z.object({
    document: approvalDocumentSchema,
    audit: auditCandidateSchema,
  }),
);

export const approvalDocumentDetailResponseSchema = successResponseSchema(
  z.object({
    document: approvalDocumentSchema,
    steps: z.array(approvalStepSchema),
    references: z.array(approvalReferenceSchema),
    comments: z.array(approvalCommentSchema),
    history: z.array(approvalHistoryItemSchema),
  }),
);

export const approvalInboxResponseSchema = successResponseSchema(
  z.object({
    items: z.array(approvalDocumentSchema),
  }),
);

export const approvalCommentListResponseSchema = successResponseSchema(
  z.object({
    document: approvalDocumentSchema,
    items: z.array(approvalCommentSchema),
  }),
);

export const approvalCommentCreateRequestSchema = z.object({
  body: z.string().min(1),
});

export const approvalCommentCreateResponseSchema = successResponseSchema(
  z.object({
    comment: approvalCommentSchema,
    audit: auditCandidateSchema,
  }),
);

export const approvalCandidateListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(approvalCandidateSchema),
  }),
);

export const approvalActionRequestSchema = z.object({
  reason: z.string().min(1),
});

export const approvalActionResponseSchema = successResponseSchema(
  z.object({
    document: approvalDocumentSchema,
    audit: auditCandidateSchema,
  }),
);

export const boardTypeSchema = z.enum(["notice", "general", "department", "document"]);
export const boardVisibilitySchema = z.enum(["company", "department", "private"]);
export const boardStatusSchema = z.enum(["active", "archived"]);
export const boardPostStatusSchema = z.enum(["draft", "published", "archived"]);
export const boardCommentStatusSchema = z.enum(["active", "hidden", "deleted"]);

export const boardSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  boardType: boardTypeSchema,
  name: z.string(),
  slug: z.string(),
  visibility: boardVisibilitySchema,
  isNoticeOnly: z.boolean(),
  status: boardStatusSchema,
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const boardPostSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  boardId: z.string(),
  authorEmployeeId: z.string(),
  title: z.string(),
  bodyPreview: z.string(),
  bodyHtml: z.string().optional(),
  prefix: z.string().nullable().optional(),
  visibilitySetting: z.string().optional(),
  notificationSettings: z.object({
    mail: z.boolean().default(false),
    push: z.boolean().default(false),
  }).optional(),
  noticePeriod: z.object({
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
  }).nullable().optional(),
  accessPolicy: z.object({
    scope: z.string().default("board-default"),
  }).optional(),
  isNotice: z.boolean(),
  publishedAt: z.string().datetime().nullable(),
  pinnedUntil: z.string().datetime().nullable(),
  status: boardPostStatusSchema,
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const boardCommentSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  postId: z.string(),
  authorEmployeeId: z.string(),
  parentCommentId: z.string().nullable(),
  body: z.string(),
  deletedAt: z.string().datetime().nullable(),
  status: boardCommentStatusSchema,
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const noticeListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(boardSchema),
  }),
);

export const boardsListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(boardSchema),
  }),
);

export const boardCreateRequestSchema = z.object({
  boardType: z.enum(["general", "department", "document"]),
  name: z.string().min(1),
  slug: z.string().min(1),
  visibility: boardVisibilitySchema,
  isNoticeOnly: z.boolean().default(false),
});

export const boardResponseSchema = successResponseSchema(
  z.object({
    board: boardSchema,
    audit: auditCandidateSchema,
  }),
);

export const boardPostCreateRequestSchema = z.object({
  title: z.string().min(1),
  bodyPreview: z.string().min(1),
  bodyHtml: z.string().optional(),
  prefix: z.string().nullable().optional(),
  visibility: z.string().optional(),
  isNotice: z.boolean().default(false),
  notificationSettings: z.object({
    mail: z.boolean().default(false),
    push: z.boolean().default(false),
  }).optional(),
  noticePeriod: z.object({
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
  }).nullable().optional(),
  accessPolicy: z.object({
    scope: z.string().default("board-default"),
  }).optional(),
});

export const boardPostListResponseSchema = successResponseSchema(
  z.object({
    board: boardSchema,
    items: z.array(boardPostSchema),
  }),
);

export const boardPostCreateResponseSchema = successResponseSchema(
  z.object({
    board: boardSchema,
    post: boardPostSchema,
    audit: auditCandidateSchema,
  }),
);

export const boardPostDetailResponseSchema = successResponseSchema(
  z.object({
    board: boardSchema,
    post: boardPostSchema,
  }),
);

export const boardCommentCreateRequestSchema = z.object({
  body: z.string().min(1),
  parentCommentId: z.string().nullable().optional(),
});

export const boardCommentListResponseSchema = successResponseSchema(
  z.object({
    post: boardPostSchema,
    items: z.array(boardCommentSchema),
  }),
);

export const boardCommentCreateResponseSchema = successResponseSchema(
  z.object({
    comment: boardCommentSchema,
    audit: auditCandidateSchema,
  }),
);

export const documentSpaceVisibilitySchema = z.enum(["company", "department", "private"]);
export const documentStatusSchema = z.enum(["active", "archived"]);
export const documentStorageProviderSchema = z.enum(["r2"]);
export const documentStorageStatusSchema = z.enum(["pending", "ready", "deleted", "failed"]);

export const documentSpaceSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  slug: z.string(),
  visibility: documentSpaceVisibilitySchema,
  ownerEmployeeId: z.string(),
  isPublicWithinCompany: z.boolean(),
  status: documentStatusSchema,
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const documentFileSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  spaceId: z.string(),
  ownerEmployeeId: z.string(),
  versionId: z.string(),
  fileName: z.string(),
  contentType: z.string(),
  fileSize: z.number().int().nonnegative(),
  versionLabel: z.string(),
  isPublicWithinCompany: z.boolean(),
  storageProvider: documentStorageProviderSchema,
  storageStatus: documentStorageStatusSchema,
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).nullable(),
  status: documentStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const documentFileUploadInitRequestSchema = z.object({
  spaceId: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().int().positive(),
  versionLabel: z.string().min(1),
  isPublicWithinCompany: z.boolean().default(false),
});

export const documentFileActionSchema = z.object({
  kind: z.enum(["r2-upload", "r2-download"]),
  provider: documentStorageProviderSchema,
  expiresAt: z.string().datetime(),
  uploadToken: z.string().min(1).optional(),
  downloadToken: z.string().min(1).optional(),
  downloadUrl: z.string().min(1).optional(),
  objectKeyPreview: z.string().min(1),
  message: z.string().min(1),
});

export const documentFileUploadInitResponseSchema = successResponseSchema(
  z.object({
    file: documentFileSchema,
    action: documentFileActionSchema,
    audit: auditCandidateSchema,
  }),
);

export const documentFileUploadCompleteRequestSchema = z.object({
  uploadToken: z.string().min(1),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  contentBase64: z.string().min(1).optional(),
});

export const documentFileUploadCompleteResponseSchema = successResponseSchema(
  z.object({
    file: documentFileSchema,
    audit: auditCandidateSchema,
  }),
);

export const documentFileDownloadInitResponseSchema = successResponseSchema(
  z.object({
    file: documentFileSchema,
    action: documentFileActionSchema,
    audit: auditCandidateSchema,
  }),
);

export const documentFileDeleteResponseSchema = successResponseSchema(
  z.object({
    file: documentFileSchema,
    audit: auditCandidateSchema,
  }),
);

export const documentSpaceListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(documentSpaceSchema),
  }),
);

export const documentSpaceCreateRequestSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  visibility: documentSpaceVisibilitySchema,
  isPublicWithinCompany: z.boolean().default(false),
});

export const documentSpaceResponseSchema = successResponseSchema(
  z.object({
    space: documentSpaceSchema,
    audit: auditCandidateSchema,
  }),
);

export const documentFileListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(documentFileSchema),
  }),
);

export const documentFileMetadataCreateRequestSchema = z.object({
  spaceId: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().int().nonnegative(),
  versionLabel: z.string().min(1),
  isPublicWithinCompany: z.boolean().default(false),
});

export const documentFileMetadataCreateResponseSchema = successResponseSchema(
  z.object({
    file: documentFileSchema,
    audit: auditCandidateSchema,
  }),
);

export const electronicContractStatusSchema = z.enum(["draft", "review_requested", "signature_requested", "signed", "rejected", "cancelled", "expired"]);
export const electronicContractPartyRoleSchema = z.enum(["owner", "reviewer", "signer", "observer"]);
export const electronicContractPartyStatusSchema = z.enum(["pending", "requested", "signed", "rejected", "cancelled"]);

export const electronicContractPartySchema = z.object({
  id: z.string(),
  contractId: z.string(),
  companyId: z.string(),
  employeeId: z.string().nullable(),
  name: z.string(),
  email: z.string().email().nullable(),
  role: electronicContractPartyRoleSchema,
  signingOrder: z.number().int().positive(),
  status: electronicContractPartyStatusSchema,
  signedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const electronicContractSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  contractType: z.string(),
  status: electronicContractStatusSchema,
  ownerUserId: z.string(),
  ownerEmployeeId: z.string(),
  fileId: z.string().nullable(),
  fileName: z.string().nullable(),
  effectiveFrom: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  externalProvider: z.string().nullable(),
  externalContractId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const electronicContractPartyCreateSchema = z.object({
  employeeId: z.string().min(1).optional(),
  name: z.string().min(1),
  email: z.string().email().optional(),
  role: electronicContractPartyRoleSchema.default("signer"),
  signingOrder: z.number().int().positive().default(1),
});

export const electronicContractCreateRequestSchema = z.object({
  title: z.string().min(1),
  summary: z.string().max(1000).optional(),
  contractType: z.string().min(1),
  fileId: z.string().min(1).optional(),
  effectiveFrom: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  parties: z.array(electronicContractPartyCreateSchema).min(1),
});

export const electronicContractStatusUpdateRequestSchema = z.object({
  status: electronicContractStatusSchema,
  reason: z.string().min(1),
});

export const electronicContractListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(electronicContractSchema),
    source: z.literal("postgres-r2"),
  }),
);

export const electronicContractDetailResponseSchema = successResponseSchema(
  z.object({
    contract: electronicContractSchema,
    parties: z.array(electronicContractPartySchema),
    source: z.literal("postgres-r2"),
  }),
);

export const electronicContractCreateResponseSchema = successResponseSchema(
  z.object({
    contract: electronicContractSchema,
    parties: z.array(electronicContractPartySchema),
    audit: auditCandidateSchema,
    source: z.literal("postgres-r2"),
  }),
);

export const electronicContractStatusUpdateResponseSchema = successResponseSchema(
  z.object({
    contract: electronicContractSchema,
    parties: z.array(electronicContractPartySchema),
    audit: auditCandidateSchema,
    source: z.literal("postgres-r2"),
  }),
);

export const erpVendorStatusSchema = z.enum(["active", "inactive", "archived"]);
export const erpVendorSyncStatusSchema = z.enum(["not_connected", "pending", "queued", "synced", "failed"]);

export const erpVendorSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  businessRegistrationNumber: z.string(),
  name: z.string(),
  representativeName: z.string().nullable(),
  address: z.string().nullable(),
  businessType: z.string().nullable(),
  businessItem: z.string().nullable(),
  contactName: z.string().nullable(),
  contactPhone: z.string().nullable(),
  contactEmail: z.string().email().nullable(),
  taxInvoiceEmail: z.string().email().nullable(),
  settlementTerm: z.string().nullable(),
  memo: z.string().nullable(),
  status: erpVendorStatusSchema,
  externalProvider: z.enum(["external_erp", "kyungrinara"]).nullable(),
  externalReferenceId: z.string().nullable(),
  syncStatus: erpVendorSyncStatusSchema,
  lastSyncedAt: z.string().datetime().nullable(),
  createdByUserId: z.string(),
  updatedByUserId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const erpVendorCreateRequestSchema = z.object({
  businessRegistrationNumber: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  representativeName: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  businessType: z.string().max(100).optional(),
  businessItem: z.string().max(100).optional(),
  contactName: z.string().max(100).optional(),
  contactPhone: z.string().max(50).optional(),
  contactEmail: z.string().email().optional(),
  taxInvoiceEmail: z.string().email().optional(),
  settlementTerm: z.string().max(200).optional(),
  memo: z.string().max(1000).optional(),
});

export const erpVendorUpdateRequestSchema = erpVendorCreateRequestSchema.partial().extend({
  reason: z.string().min(1),
});

export const erpVendorStatusUpdateRequestSchema = z.object({
  status: erpVendorStatusSchema,
  reason: z.string().min(1),
});

export const erpVendorListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(erpVendorSchema),
    source: z.literal("postgres"),
  }),
);

export const erpVendorMutationResponseSchema = successResponseSchema(
  z.object({
    vendor: erpVendorSchema,
    audit: auditCandidateSchema,
    source: z.literal("postgres"),
  }),
);

export const erpExpenseStatusSchema = z.enum(["draft", "submitted", "approved", "rejected", "cancelled"]);
export const erpExpensePaymentMethodSchema = z.enum(["corporate_card", "bank_transfer", "cash", "personal_card", "other"]);
export const erpExpenseTaxTypeSchema = z.enum(["taxable", "zero_rated", "tax_exempt", "non_taxable"]);

export const erpExpenseRequestSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  vendorId: z.string().nullable(),
  vendorName: z.string().nullable(),
  title: z.string(),
  expenseCategory: z.string(),
  departmentId: z.string().nullable(),
  branchId: z.string().nullable(),
  projectCode: z.string().nullable(),
  paymentMethod: erpExpensePaymentMethodSchema,
  taxType: erpExpenseTaxTypeSchema,
  supplyAmount: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  totalAmount: z.number().nonnegative(),
  spentAt: isoDateSchema,
  evidenceFileId: z.string().nullable(),
  approvalDocumentId: z.string().nullable(),
  status: erpExpenseStatusSchema,
  syncStatus: erpVendorSyncStatusSchema,
  externalProvider: z.enum(["external_erp", "kyungrinara"]).nullable(),
  externalReferenceId: z.string().nullable(),
  lastSyncedAt: z.string().datetime().nullable(),
  memo: z.string().nullable(),
  requestedByUserId: z.string(),
  requestedByEmployeeId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const erpExpenseRequestCreateRequestSchema = z.object({
  vendorId: z.string().min(1).optional(),
  title: z.string().min(1).max(200),
  expenseCategory: z.string().min(1).max(100),
  departmentId: z.string().max(100).optional(),
  branchId: z.string().max(100).optional(),
  projectCode: z.string().max(100).optional(),
  paymentMethod: erpExpensePaymentMethodSchema,
  taxType: erpExpenseTaxTypeSchema.default("taxable"),
  supplyAmount: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  spentAt: isoDateSchema,
  evidenceFileId: z.string().min(1).optional(),
  approvalDocumentId: z.string().min(1).optional(),
  memo: z.string().max(1000).optional(),
});

export const erpExpenseRequestUpdateRequestSchema = erpExpenseRequestCreateRequestSchema.partial().extend({
  reason: z.string().min(1),
});

export const erpExpenseRequestStatusUpdateRequestSchema = z.object({
  status: erpExpenseStatusSchema,
  reason: z.string().min(1),
});

export const erpExpenseRequestListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(erpExpenseRequestSchema),
    source: z.literal("postgres"),
  }),
);

export const erpExpenseRequestMutationResponseSchema = successResponseSchema(
  z.object({
    expense: erpExpenseRequestSchema,
    audit: auditCandidateSchema,
    source: z.literal("postgres"),
  }),
);

export const erpEvidenceTypeSchema = z.enum(["receipt", "tax_invoice", "transaction_statement", "contract", "business_registration", "other"]);
export const erpEvidenceStatusSchema = z.enum(["draft", "submitted", "accepted", "rework_requested", "archived"]);

export const erpEvidenceSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  expenseId: z.string().nullable(),
  expenseTitle: z.string().nullable(),
  vendorId: z.string().nullable(),
  vendorName: z.string().nullable(),
  fileId: z.string(),
  fileName: z.string().nullable(),
  evidenceType: erpEvidenceTypeSchema,
  title: z.string(),
  issuedAt: isoDateSchema.nullable(),
  supplyAmount: z.number().nonnegative().nullable(),
  taxAmount: z.number().nonnegative().nullable(),
  totalAmount: z.number().nonnegative().nullable(),
  status: erpEvidenceStatusSchema,
  reworkReason: z.string().nullable(),
  memo: z.string().nullable(),
  syncStatus: erpVendorSyncStatusSchema,
  externalProvider: z.enum(["external_erp", "kyungrinara"]).nullable(),
  externalReferenceId: z.string().nullable(),
  lastSyncedAt: z.string().datetime().nullable(),
  createdByUserId: z.string(),
  updatedByUserId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const erpEvidenceCreateRequestSchema = z.object({
  expenseId: z.string().min(1).optional(),
  vendorId: z.string().min(1).optional(),
  fileId: z.string().min(1),
  evidenceType: erpEvidenceTypeSchema,
  title: z.string().min(1).max(200),
  issuedAt: isoDateSchema.optional(),
  supplyAmount: z.number().nonnegative().optional(),
  taxAmount: z.number().nonnegative().optional(),
  totalAmount: z.number().nonnegative().optional(),
  memo: z.string().max(1000).optional(),
});

export const erpEvidenceUpdateRequestSchema = erpEvidenceCreateRequestSchema.partial().extend({
  reason: z.string().min(1),
});

export const erpEvidenceStatusUpdateRequestSchema = z.object({
  status: erpEvidenceStatusSchema,
  reason: z.string().min(1),
});

export const erpEvidenceListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(erpEvidenceSchema),
    source: z.literal("postgres-r2"),
  }),
);

export const erpEvidenceMutationResponseSchema = successResponseSchema(
  z.object({
    evidence: erpEvidenceSchema,
    audit: auditCandidateSchema,
    source: z.literal("postgres-r2"),
  }),
);

export const erpBillingStatusSchema = z.enum(["draft", "requested", "approved", "issued", "paid", "overdue", "cancelled"]);
export const erpBillingPaymentStatusSchema = z.enum(["not_due", "scheduled", "partial", "paid", "overdue", "cancelled"]);
export const erpBillingTaxInvoiceStatusSchema = z.enum(["not_requested", "requested", "issued", "failed", "cancelled"]);

export const erpBillingSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  vendorId: z.string(),
  vendorName: z.string().nullable(),
  contractId: z.string().nullable(),
  title: z.string(),
  billingCategory: z.string(),
  departmentId: z.string().nullable(),
  branchId: z.string().nullable(),
  projectCode: z.string().nullable(),
  supplyAmount: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  totalAmount: z.number().nonnegative(),
  billingDueDate: isoDateSchema,
  paymentDueDate: isoDateSchema.nullable(),
  issuedAt: isoDateSchema.nullable(),
  paidAt: isoDateSchema.nullable(),
  status: erpBillingStatusSchema,
  paymentStatus: erpBillingPaymentStatusSchema,
  taxInvoiceStatus: erpBillingTaxInvoiceStatusSchema,
  syncStatus: erpVendorSyncStatusSchema,
  externalProvider: z.enum(["external_erp", "kyungrinara"]).nullable(),
  externalReferenceId: z.string().nullable(),
  lastSyncedAt: z.string().datetime().nullable(),
  memo: z.string().nullable(),
  createdByUserId: z.string(),
  updatedByUserId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const erpBillingCreateRequestSchema = z.object({
  vendorId: z.string().min(1),
  contractId: z.string().max(120).optional(),
  title: z.string().min(1).max(200),
  billingCategory: z.string().min(1).max(120),
  departmentId: z.string().max(120).optional(),
  branchId: z.string().max(120).optional(),
  projectCode: z.string().max(100).optional(),
  supplyAmount: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  billingDueDate: isoDateSchema,
  paymentDueDate: isoDateSchema.optional(),
  memo: z.string().max(1000).optional(),
});

export const erpBillingUpdateRequestSchema = erpBillingCreateRequestSchema.partial().extend({
  reason: z.string().min(1),
});

export const erpBillingStatusUpdateRequestSchema = z.object({
  status: erpBillingStatusSchema,
  paymentStatus: erpBillingPaymentStatusSchema.optional(),
  taxInvoiceStatus: erpBillingTaxInvoiceStatusSchema.optional(),
  reason: z.string().min(1),
});

export const erpBillingListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(erpBillingSchema),
    source: z.literal("postgres"),
  }),
);

export const erpBillingMutationResponseSchema = successResponseSchema(
  z.object({
    billing: erpBillingSchema,
    audit: auditCandidateSchema,
    source: z.literal("postgres"),
  }),
);

export const erpPaymentDirectionSchema = z.enum(["inbound", "outbound"]);
export const erpPaymentMethodSchema = z.enum(["bank_transfer", "card", "cash", "virtual_account", "other"]);
export const erpPaymentMatchStatusSchema = z.enum(["unmatched", "partially_matched", "matched", "overpaid", "cancelled"]);
export const erpReceivableStatusSchema = z.enum(["not_due", "due", "partial", "paid", "overdue", "write_off", "cancelled"]);

export const erpPaymentRecordSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  billingId: z.string().nullable(),
  billingTitle: z.string().nullable(),
  vendorId: z.string().nullable(),
  vendorName: z.string().nullable(),
  direction: erpPaymentDirectionSchema,
  paymentMethod: erpPaymentMethodSchema,
  amount: z.number().nonnegative(),
  expectedAt: isoDateSchema.nullable(),
  occurredAt: isoDateSchema.nullable(),
  matchStatus: erpPaymentMatchStatusSchema,
  receivableStatus: erpReceivableStatusSchema,
  bankAccountLabel: z.string().nullable(),
  transactionMemo: z.string().nullable(),
  syncStatus: erpVendorSyncStatusSchema,
  externalProvider: z.enum(["external_erp", "kyungrinara"]).nullable(),
  externalReferenceId: z.string().nullable(),
  lastSyncedAt: z.string().datetime().nullable(),
  createdByUserId: z.string(),
  updatedByUserId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const erpPaymentRecordCreateRequestSchema = z.object({
  billingId: z.string().min(1).optional(),
  vendorId: z.string().min(1).optional(),
  direction: erpPaymentDirectionSchema.default("inbound"),
  paymentMethod: erpPaymentMethodSchema.default("bank_transfer"),
  amount: z.number().nonnegative(),
  expectedAt: isoDateSchema.optional(),
  occurredAt: isoDateSchema.optional(),
  matchStatus: erpPaymentMatchStatusSchema.default("unmatched"),
  receivableStatus: erpReceivableStatusSchema.default("not_due"),
  bankAccountLabel: z.string().max(120).optional(),
  transactionMemo: z.string().max(1000).optional(),
});

export const erpPaymentRecordUpdateRequestSchema = erpPaymentRecordCreateRequestSchema.partial().extend({
  reason: z.string().min(1),
});

export const erpPaymentRecordStatusUpdateRequestSchema = z.object({
  matchStatus: erpPaymentMatchStatusSchema,
  receivableStatus: erpReceivableStatusSchema,
  reason: z.string().min(1),
});

export const erpPaymentRecordListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(erpPaymentRecordSchema),
    source: z.literal("postgres"),
  }),
);

export const erpPaymentRecordMutationResponseSchema = successResponseSchema(
  z.object({
    paymentRecord: erpPaymentRecordSchema,
    audit: auditCandidateSchema,
    source: z.literal("postgres"),
  }),
);

export const erpAccountSubjectTypeSchema = z.enum(["asset", "liability", "equity", "revenue", "expense"]);
export const erpAccountSubjectStatusSchema = z.enum(["active", "inactive", "archived"]);

export const erpAccountSubjectSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  name: z.string(),
  type: erpAccountSubjectTypeSchema,
  parentId: z.string().nullable(),
  status: erpAccountSubjectStatusSchema,
  memo: z.string().nullable(),
  createdByUserId: z.string(),
  updatedByUserId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const erpAccountSubjectCreateRequestSchema = z.object({
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(160),
  type: erpAccountSubjectTypeSchema,
  parentId: z.string().max(160).optional(),
  memo: z.string().max(1000).optional(),
});

export const erpJournalEntryStatusSchema = z.enum(["draft", "posted", "reversed", "cancelled"]);
export const erpJournalEntryLineSchema = z.object({
  id: z.string(),
  accountSubjectId: z.string(),
  accountCode: z.string().nullable(),
  accountName: z.string().nullable(),
  debitAmount: z.number().nonnegative(),
  creditAmount: z.number().nonnegative(),
  memo: z.string().nullable(),
});

export const erpJournalEntrySchema = z.object({
  id: z.string(),
  companyId: z.string(),
  entryNumber: z.string(),
  entryDate: z.string(),
  title: z.string(),
  status: erpJournalEntryStatusSchema,
  sourceType: z.enum(["manual", "expense", "billing", "payment", "closing"]),
  sourceId: z.string().nullable(),
  totalDebitAmount: z.number().nonnegative(),
  totalCreditAmount: z.number().nonnegative(),
  memo: z.string().nullable(),
  createdByUserId: z.string(),
  updatedByUserId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lines: z.array(erpJournalEntryLineSchema),
});

export const erpJournalEntryCreateRequestSchema = z.object({
  entryDate: z.string().min(10).max(10),
  title: z.string().min(1).max(200),
  sourceType: z.enum(["manual", "expense", "billing", "payment", "closing"]).default("manual"),
  sourceId: z.string().max(160).optional(),
  memo: z.string().max(1000).optional(),
  lines: z.array(z.object({
    accountSubjectId: z.string().min(1),
    debitAmount: z.number().nonnegative().default(0),
    creditAmount: z.number().nonnegative().default(0),
    memo: z.string().max(1000).optional(),
  })).min(2),
});

export const erpJournalEntryStatusUpdateRequestSchema = z.object({
  status: erpJournalEntryStatusSchema,
  reason: z.string().min(1),
});

export const erpAccountSubjectListResponseSchema = successResponseSchema(
  z.object({ items: z.array(erpAccountSubjectSchema), source: z.literal("postgres") }),
);
export const erpAccountSubjectMutationResponseSchema = successResponseSchema(
  z.object({ accountSubject: erpAccountSubjectSchema, audit: auditCandidateSchema, source: z.literal("postgres") }),
);
export const erpJournalEntryListResponseSchema = successResponseSchema(
  z.object({ items: z.array(erpJournalEntrySchema), source: z.literal("postgres") }),
);
export const erpJournalEntryMutationResponseSchema = successResponseSchema(
  z.object({ journalEntry: erpJournalEntrySchema, audit: auditCandidateSchema, source: z.literal("postgres") }),
);

export const erpLedgerEntrySchema = z.object({
  id: z.string(),
  companyId: z.string(),
  journalEntryId: z.string(),
  journalEntryNumber: z.string(),
  entryDate: z.string(),
  journalStatus: erpJournalEntryStatusSchema,
  sourceType: z.enum(["manual", "expense", "billing", "payment", "closing"]),
  accountSubjectId: z.string(),
  accountCode: z.string(),
  accountName: z.string(),
  accountType: erpAccountSubjectTypeSchema,
  description: z.string(),
  counterpartySummary: z.string().nullable(),
  debitAmount: z.number().nonnegative(),
  creditAmount: z.number().nonnegative(),
  runningBalance: z.number(),
});

export const erpLedgerSummarySchema = z.object({
  totalDebitAmount: z.number().nonnegative(),
  totalCreditAmount: z.number().nonnegative(),
  balance: z.number(),
  accountCount: z.number().int().nonnegative(),
  entryCount: z.number().int().nonnegative(),
  postedEntryCount: z.number().int().nonnegative(),
});

export const erpLedgerEntryListResponseSchema = successResponseSchema(
  z.object({ items: z.array(erpLedgerEntrySchema), summary: erpLedgerSummarySchema, source: z.literal("postgres") }),
);

export const erpClosingPeriodStatusSchema = z.enum(["open", "locked", "closed"]);
export const erpClosingPeriodSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  status: erpClosingPeriodStatusSchema,
  lockedAt: z.string().datetime().nullable(),
  closedAt: z.string().datetime().nullable(),
  memo: z.string().nullable(),
  createdByUserId: z.string(),
  updatedByUserId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const erpClosingPeriodCreateRequestSchema = z.object({
  periodStart: z.string().min(10).max(10),
  periodEnd: z.string().min(10).max(10),
  status: erpClosingPeriodStatusSchema.default("locked"),
  memo: z.string().max(1000).optional(),
}).refine((value) => value.periodStart <= value.periodEnd, {
  message: "periodStart must be before or equal to periodEnd",
  path: ["periodEnd"],
});

export const erpClosingPeriodStatusUpdateRequestSchema = z.object({
  status: erpClosingPeriodStatusSchema,
  reason: z.string().min(1),
});

export const erpClosingPeriodListResponseSchema = successResponseSchema(
  z.object({ items: z.array(erpClosingPeriodSchema), source: z.literal("postgres") }),
);

export const erpClosingPeriodMutationResponseSchema = successResponseSchema(
  z.object({ closingPeriod: erpClosingPeriodSchema, audit: auditCandidateSchema, source: z.literal("postgres") }),
);

export const erpTaxDocumentTypeSchema = z.enum(["sales_tax_invoice", "purchase_tax_invoice", "cash_receipt", "vat_adjustment"]);
export const erpTaxDocumentStatusSchema = z.enum(["draft", "matched", "review_required", "reported", "archived"]);

export const erpTaxDocumentSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  documentType: erpTaxDocumentTypeSchema,
  issueDate: z.string(),
  vendorName: z.string(),
  businessRegistrationNumberHash: z.string().nullable(),
  supplyAmount: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  totalAmount: z.number().nonnegative(),
  linkedEvidenceId: z.string().nullable(),
  linkedBillingId: z.string().nullable(),
  linkedJournalEntryId: z.string().nullable(),
  status: erpTaxDocumentStatusSchema,
  providerStatus: z.literal("not_connected"),
  memo: z.string().nullable(),
  createdByUserId: z.string(),
  updatedByUserId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const erpTaxDocumentCreateRequestSchema = z.object({
  documentType: erpTaxDocumentTypeSchema,
  issueDate: z.string().min(10).max(10),
  vendorName: z.string().min(1).max(200),
  businessRegistrationNumber: z.string().max(40).optional(),
  supplyAmount: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  linkedEvidenceId: z.string().max(160).optional(),
  linkedBillingId: z.string().max(160).optional(),
  linkedJournalEntryId: z.string().max(160).optional(),
  status: erpTaxDocumentStatusSchema.default("draft"),
  memo: z.string().max(1000).optional(),
});

export const erpTaxDocumentListResponseSchema = successResponseSchema(
  z.object({ items: z.array(erpTaxDocumentSchema), source: z.literal("postgres") }),
);
export const erpTaxDocumentMutationResponseSchema = successResponseSchema(
  z.object({ taxDocument: erpTaxDocumentSchema, audit: auditCandidateSchema, source: z.literal("postgres") }),
);

export const erpTaxReportPackageStatusSchema = z.enum(["draft", "locked", "exported"]);
export const erpTaxReportPackageSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  status: erpTaxReportPackageStatusSchema,
  salesSupplyAmount: z.number().nonnegative(),
  salesTaxAmount: z.number().nonnegative(),
  purchaseSupplyAmount: z.number().nonnegative(),
  purchaseTaxAmount: z.number().nonnegative(),
  documentCount: z.number().int().nonnegative(),
  providerStatus: z.literal("not_connected"),
  memo: z.string().nullable(),
  createdByUserId: z.string(),
  updatedByUserId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const erpTaxReportPackageCreateRequestSchema = z.object({
  periodStart: z.string().min(10).max(10),
  periodEnd: z.string().min(10).max(10),
  status: erpTaxReportPackageStatusSchema.default("draft"),
  memo: z.string().max(1000).optional(),
}).refine((value) => value.periodStart <= value.periodEnd, { message: "periodStart must be before or equal to periodEnd", path: ["periodEnd"] });

export const erpTaxReportPackageListResponseSchema = successResponseSchema(
  z.object({ items: z.array(erpTaxReportPackageSchema), source: z.literal("postgres") }),
);
export const erpTaxReportPackageMutationResponseSchema = successResponseSchema(
  z.object({ taxReportPackage: erpTaxReportPackageSchema, audit: auditCandidateSchema, source: z.literal("postgres") }),
);

export const erpAccountingMappingTypeSchema = z.enum([
  "expense_category",
  "revenue_category",
  "department",
  "branch",
  "project",
  "tax_type",
  "payment_method",
  "vendor_type",
]);
export const erpAccountingMappingStatusSchema = z.enum(["unmapped", "mapped", "review_required", "disabled"]);
export const erpAccountingMappingRecordStatusSchema = z.enum(["active", "inactive", "archived"]);

export const erpAccountingMappingSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  mappingType: erpAccountingMappingTypeSchema,
  internalCode: z.string(),
  internalName: z.string(),
  externalProvider: z.enum(["external_erp", "kyungrinara"]).nullable(),
  externalCode: z.string().nullable(),
  externalName: z.string().nullable(),
  mappingStatus: erpAccountingMappingStatusSchema,
  status: erpAccountingMappingRecordStatusSchema,
  memo: z.string().nullable(),
  createdByUserId: z.string(),
  updatedByUserId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const erpAccountingMappingCreateRequestSchema = z.object({
  mappingType: erpAccountingMappingTypeSchema,
  internalCode: z.string().min(1).max(120),
  internalName: z.string().min(1).max(200),
  externalCode: z.string().max(120).optional(),
  externalName: z.string().max(200).optional(),
  mappingStatus: erpAccountingMappingStatusSchema.default("unmapped"),
  memo: z.string().max(1000).optional(),
});

export const erpAccountingMappingUpdateRequestSchema = erpAccountingMappingCreateRequestSchema.partial().extend({
  reason: z.string().min(1),
});

export const erpAccountingMappingStatusUpdateRequestSchema = z.object({
  status: erpAccountingMappingRecordStatusSchema,
  mappingStatus: erpAccountingMappingStatusSchema.optional(),
  reason: z.string().min(1),
});

export const erpAccountingMappingListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(erpAccountingMappingSchema),
    source: z.literal("postgres"),
  }),
);

export const erpAccountingMappingMutationResponseSchema = successResponseSchema(
  z.object({
    mapping: erpAccountingMappingSchema,
    audit: auditCandidateSchema,
    source: z.literal("postgres"),
  }),
);

export const erpIntegrationProviderSchema = z.enum(["external_erp", "kyungrinara"]);
export const erpIntegrationEventDirectionSchema = z.enum(["outbound", "inbound", "webhook"]);
export const erpIntegrationEventResourceTypeSchema = z.enum(["vendor", "expense", "evidence", "billing", "payment", "accounting_mapping", "tax_invoice", "other"]);
export const erpIntegrationEventStatusSchema = z.enum(["queued", "sending", "succeeded", "failed", "retry_required", "cancelled"]);

export const erpIntegrationEventSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  provider: erpIntegrationProviderSchema,
  direction: erpIntegrationEventDirectionSchema,
  resourceType: erpIntegrationEventResourceTypeSchema,
  resourceId: z.string().nullable(),
  title: z.string(),
  status: erpIntegrationEventStatusSchema,
  attemptCount: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  nextRetryAt: z.string().datetime().nullable(),
  externalReferenceId: z.string().nullable(),
  externalStatus: z.string().nullable(),
  failureCode: z.string().nullable(),
  failureMessage: z.string().nullable(),
  safePayloadSummary: z.string().nullable(),
  safeResponseSummary: z.string().nullable(),
  requestedByUserId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const erpIntegrationEventCreateRequestSchema = z.object({
  direction: erpIntegrationEventDirectionSchema.default("outbound"),
  resourceType: erpIntegrationEventResourceTypeSchema,
  resourceId: z.string().max(160).optional(),
  title: z.string().min(1).max(200),
  status: erpIntegrationEventStatusSchema.default("queued"),
  maxAttempts: z.number().int().positive().max(10).default(3),
  nextRetryAt: z.string().datetime().optional(),
  externalReferenceId: z.string().max(200).optional(),
  externalStatus: z.string().max(120).optional(),
  failureCode: z.string().max(120).optional(),
  failureMessage: z.string().max(1000).optional(),
  safePayloadSummary: z.string().max(2000).optional(),
  safeResponseSummary: z.string().max(2000).optional(),
});

export const erpIntegrationEventUpdateRequestSchema = erpIntegrationEventCreateRequestSchema.partial().extend({
  reason: z.string().min(1),
});

export const erpIntegrationEventStatusUpdateRequestSchema = z.object({
  status: erpIntegrationEventStatusSchema,
  failureCode: z.string().max(120).optional(),
  failureMessage: z.string().max(1000).optional(),
  externalReferenceId: z.string().max(200).optional(),
  externalStatus: z.string().max(120).optional(),
  nextRetryAt: z.string().datetime().optional(),
  reason: z.string().min(1),
});

export const erpIntegrationEventListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(erpIntegrationEventSchema),
    source: z.literal("postgres"),
  }),
);

export const erpIntegrationEventMutationResponseSchema = successResponseSchema(
  z.object({
    event: erpIntegrationEventSchema,
    audit: auditCandidateSchema,
    source: z.literal("postgres"),
  }),
);

export const vehicleOperationLogStatusSchema = z.enum(["draft", "submitted", "approved", "rejected", "cancelled"]);
export const vehicleOperationPurposeSchema = z.enum(["sales", "delivery", "commute", "site_visit", "maintenance", "other"]);
export const vehicleFuelTypeSchema = z.enum(["gasoline", "diesel", "lpg", "electric", "hybrid", "hydrogen", "other"]);

export const vehicleSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  vehicleNumber: z.string(),
  displayName: z.string(),
  fuelType: vehicleFuelTypeSchema,
  defaultDriverEmployeeId: z.string().nullable(),
  defaultDriverName: z.string().nullable(),
  odometerKm: z.number().nonnegative().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const vehicleOperationLogSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  vehicleId: z.string(),
  vehicleNumber: z.string(),
  vehicleDisplayName: z.string(),
  driverUserId: z.string(),
  driverEmployeeId: z.string(),
  driverName: z.string(),
  operationDate: isoDateSchema,
  purpose: vehicleOperationPurposeSchema,
  purposeDetail: z.string().nullable(),
  departurePlace: z.string(),
  arrivalPlace: z.string(),
  startedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
  startOdometerKm: z.number().nonnegative().nullable(),
  endOdometerKm: z.number().nonnegative().nullable(),
  distanceKm: z.number().nonnegative(),
  fuelCost: z.number().nonnegative(),
  tollCost: z.number().nonnegative(),
  parkingCost: z.number().nonnegative(),
  otherCost: z.number().nonnegative(),
  memo: z.string().nullable(),
  status: vehicleOperationLogStatusSchema,
  submittedAt: z.string().datetime().nullable(),
  approvedAt: z.string().datetime().nullable(),
  approvedByUserId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const vehicleOperationLogCreateRequestSchema = z.object({
  vehicleId: z.string().min(1),
  operationDate: isoDateSchema,
  purpose: vehicleOperationPurposeSchema,
  purposeDetail: z.string().max(500).optional(),
  departurePlace: z.string().min(1),
  arrivalPlace: z.string().min(1),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  startOdometerKm: z.number().nonnegative().optional(),
  endOdometerKm: z.number().nonnegative().optional(),
  distanceKm: z.number().nonnegative(),
  fuelCost: z.number().nonnegative().default(0),
  tollCost: z.number().nonnegative().default(0),
  parkingCost: z.number().nonnegative().default(0),
  otherCost: z.number().nonnegative().default(0),
  memo: z.string().max(2000).optional(),
});

export const vehicleOperationLogUpdateRequestSchema = vehicleOperationLogCreateRequestSchema.partial().extend({
  reason: z.string().min(1),
});

export const vehicleListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(vehicleSchema),
    source: z.literal("postgres"),
  }),
);

export const vehicleOperationLogListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(vehicleOperationLogSchema),
    source: z.literal("postgres"),
  }),
);

export const vehicleOperationLogDetailResponseSchema = successResponseSchema(
  z.object({
    log: vehicleOperationLogSchema,
    source: z.literal("postgres"),
  }),
);

export const vehicleOperationLogMutationResponseSchema = successResponseSchema(
  z.object({
    log: vehicleOperationLogSchema,
    audit: auditCandidateSchema,
    source: z.literal("postgres"),
  }),
);

export const workItemListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(workItemSchema),
  }),
);

export const workItemDetailResponseSchema = successResponseSchema(
  z.object({
    item: workItemSchema,
    auditLogs: z.array(workItemAuditLogSchema),
  }),
);

export const workItemDocumentsResponseSchema = successResponseSchema(
  z.object({
    items: z.array(workItemDocumentSchema),
  }),
);

export const workItemAttachmentsResponseSchema = successResponseSchema(
  z.object({
    items: z.array(workItemAttachmentSchema),
  }),
);

export const workItemReviewsResponseSchema = successResponseSchema(
  z.object({
    items: z.array(workItemReviewSchema),
  }),
);

export const workItemDeadlinesResponseSchema = successResponseSchema(
  z.object({
    items: z.array(workItemDeadlineSchema),
  }),
);

export const payrollProfileListResponseSchema = successResponseSchema(
  z.object({
    items: z.array(payrollProfileSchema),
  }),
);

export const readReceiptTargetTypeSchema = z.enum(["post", "document_file"]);

export const readReceiptSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  targetType: readReceiptTargetTypeSchema,
  targetId: z.string(),
  employeeId: z.string(),
  readAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const readReceiptCreateRequestSchema = z.object({
  targetType: readReceiptTargetTypeSchema,
  targetId: z.string().min(1),
});

export const readReceiptCreateResponseSchema = successResponseSchema(
  z.object({
    receipt: readReceiptSchema,
    audit: auditCandidateSchema,
  }),
);

export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type RoleCode = z.infer<typeof roleCodeSchema>;
export type PermissionCode = z.infer<typeof permissionCodeSchema>;
export type HealthPayload = z.infer<typeof healthPayloadSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type SessionUser = z.infer<typeof sessionUserSchema>;
export type AuthLoginRequest = z.infer<typeof authLoginRequestSchema>;
export type AuthLoginResponse = z.infer<typeof authLoginResponseSchema>;
export type AuthLogoutResponse = z.infer<typeof authLogoutResponseSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type SecondaryPasswordStatusResponse = z.infer<typeof secondaryPasswordStatusResponseSchema>;
export type SecondaryPasswordUpdateRequest = z.infer<typeof secondaryPasswordUpdateRequestSchema>;
export type SecondaryPasswordUpdateResponse = z.infer<typeof secondaryPasswordUpdateResponseSchema>;
export type SecondaryPasswordVerifyRequest = z.infer<typeof secondaryPasswordVerifyRequestSchema>;
export type SecondaryPasswordVerifyResponse = z.infer<typeof secondaryPasswordVerifyResponseSchema>;
export type UserPreferencesResponse = z.infer<typeof userPreferencesResponseSchema>;
export type UserPreferencesUpdateRequest = z.infer<typeof userPreferencesUpdateRequestSchema>;
export type UserPreferencesUpdateResponse = z.infer<typeof userPreferencesUpdateResponseSchema>;
export type AdminPermissionUserId = z.infer<typeof adminPermissionUserIdSchema>;
export type AdminFeaturePermissionKey = z.infer<typeof adminFeaturePermissionKeySchema>;
export type AdminPermissionState = z.infer<typeof adminPermissionStateSchema>;
export type AdminPermissionSettingsResponse = z.infer<typeof adminPermissionSettingsResponseSchema>;
export type AdminPermissionSettingsUpdateRequest = z.infer<typeof adminPermissionSettingsUpdateRequestSchema>;
export type AdminPermissionSettingsUpdateResponse = z.infer<typeof adminPermissionSettingsUpdateResponseSchema>;
export type Company = z.infer<typeof companySchema>;
export type Employee = z.infer<typeof employeeSchema>;
export type EmployeeDirectorySummary = z.infer<typeof employeeDirectorySummarySchema>;
export type EmployeeDirectoryFilters = z.infer<typeof employeeDirectoryFiltersSchema>;
export type EmployeeDirectoryFilterOptions = z.infer<typeof employeeDirectoryFilterOptionsSchema>;
export type Department = z.infer<typeof departmentSchema>;
export type BranchViewerScope = z.infer<typeof branchViewerScopeSchema>;
export type BranchSummary = z.infer<typeof branchSummarySchema>;
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type Permission = z.infer<typeof permissionSchema>;
export type HomeShortcut = z.infer<typeof homeShortcutSchema>;
export type Role = z.infer<typeof roleSchema>;
export type OrgDirectorySectionSummary = z.infer<typeof orgDirectorySectionSummarySchema>;
export type CreateInviteRequest = z.infer<typeof createInviteRequestSchema>;
export type CreateInviteResponse = z.infer<typeof createInviteResponseSchema>;
export type AdminScope = z.infer<typeof adminScopeSchema>;
export type AdminUserSummary = z.infer<typeof adminUserSummarySchema>;
export type AdminUsersListResponse = z.infer<typeof adminUsersListResponseSchema>;
export type AdminPolicyCategory = z.infer<typeof adminPolicyCategorySchema>;
export type AdminPolicyVisibility = z.infer<typeof adminPolicyVisibilitySchema>;
export type AttendanceRegistrationMethod = z.infer<typeof attendanceRegistrationMethodSchema>;
export type AttendanceRegistrationPolicy = z.infer<typeof attendanceRegistrationPolicySchema>;
export type AttendancePolicyLevel = z.infer<typeof attendancePolicyLevelSchema>;
export type AttendancePolicyRule = z.infer<typeof attendancePolicyRuleSchema>;
export type AttendancePolicyAssignment = z.infer<typeof attendancePolicyAssignmentSchema>;
export type EffectiveAttendancePolicy = z.infer<typeof effectiveAttendancePolicySchema>;
export type AttendancePolicyScopeSummary = z.infer<typeof attendancePolicyScopeSummarySchema>;
export type AttendancePolicyReview = z.infer<typeof attendancePolicyReviewSchema>;
export type AdminPolicySummary = z.infer<typeof adminPolicySummarySchema>;
export type AdminPoliciesListResponse = z.infer<typeof adminPoliciesListResponseSchema>;
export type AdminPolicyDocumentUpdateRequest = z.infer<typeof adminPolicyDocumentUpdateRequestSchema>;
export type AdminPolicyBoardUpdateRequest = z.infer<typeof adminPolicyBoardUpdateRequestSchema>;
export type AdminPolicyUpdateResponse = z.infer<typeof adminPolicyUpdateResponseSchema>;
export type AdminAuditCategory = z.infer<typeof adminAuditCategorySchema>;
export type AdminAuditSource = z.infer<typeof adminAuditSourceSchema>;
export type AdminAuditStorageStatus = z.infer<typeof adminAuditStorageStatusSchema>;
export type AdminAuditMetadata = z.infer<typeof adminAuditMetadataSchema>;
export type AdminAuditTargetType = z.infer<typeof adminAuditTargetTypeSchema>;
export type AdminAuditLog = z.infer<typeof adminAuditLogSchema>;
export type AdminAuditLogFilters = z.infer<typeof adminAuditLogFiltersSchema>;
export type AdminAuditLogListResponse = z.infer<typeof adminAuditLogListResponseSchema>;
export type NotificationListResponse = z.infer<typeof listNotificationsResponseSchema>;
export type BranchListResponse = z.infer<typeof listBranchesResponseSchema>;
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;
export type AttendanceActionRequest = z.infer<typeof attendanceActionRequestSchema>;
export type AttendanceActionResponse = z.infer<typeof attendanceActionResponseSchema>;
export type AttendanceListRecordsResponse = z.infer<typeof attendanceListRecordsResponseSchema>;
export type AttendanceCorrectionRequest = z.infer<typeof attendanceCorrectionRequestSchema>;
export type AttendanceCorrectionResponse = z.infer<typeof attendanceCorrectionResponseSchema>;
export type LeaveType = z.infer<typeof leaveTypeSchema>;
export type LeaveBalance = z.infer<typeof leaveBalanceSchema>;
export type LeaveRequest = z.infer<typeof leaveRequestSchema>;
export type LeaveTypeListResponse = z.infer<typeof leaveTypeListResponseSchema>;
export type LeaveBalanceListResponse = z.infer<typeof leaveBalanceListResponseSchema>;
export type LeaveRequestListResponse = z.infer<typeof leaveRequestListResponseSchema>;
export type LeaveRequestCreateRequest = z.infer<typeof leaveRequestCreateRequestSchema>;
export type LeaveRequestCreateResponse = z.infer<typeof leaveRequestCreateResponseSchema>;
export type LeaveActionRequest = z.infer<typeof leaveActionRequestSchema>;
export type LeaveActionResponse = z.infer<typeof leaveActionResponseSchema>;
export type ApprovalForm = z.infer<typeof approvalFormSchema>;
export type ApprovalStep = z.infer<typeof approvalStepSchema>;
export type ApprovalLine = z.infer<typeof approvalLineSchema>;
export type ApprovalDocument = z.infer<typeof approvalDocumentSchema>;
export type ApprovalReference = z.infer<typeof approvalReferenceSchema>;
export type ApprovalComment = z.infer<typeof approvalCommentSchema>;
export type ApprovalHistoryItem = z.infer<typeof approvalHistoryItemSchema>;
export type ApprovalCandidate = z.infer<typeof approvalCandidateSchema>;
export type ApprovalFormListResponse = z.infer<typeof approvalFormListResponseSchema>;
export type ApprovalFormCreateRequest = z.infer<typeof approvalFormCreateRequestSchema>;
export type ApprovalFormCreateResponse = z.infer<typeof approvalFormCreateResponseSchema>;
export type ApprovalLineCreateRequest = z.infer<typeof approvalLineCreateRequestSchema>;
export type ApprovalLineListResponse = z.infer<typeof approvalLineListResponseSchema>;
export type ApprovalLineCreateResponse = z.infer<typeof approvalLineCreateResponseSchema>;
export type ApprovalDocumentCreateRequest = z.infer<typeof approvalDocumentCreateRequestSchema>;
export type ApprovalDocumentListResponse = z.infer<typeof approvalDocumentListResponseSchema>;
export type ApprovalDocumentCreateResponse = z.infer<typeof approvalDocumentCreateResponseSchema>;
export type ApprovalDocumentDetailResponse = z.infer<typeof approvalDocumentDetailResponseSchema>;
export type ApprovalInboxResponse = z.infer<typeof approvalInboxResponseSchema>;
export type ApprovalCommentListResponse = z.infer<typeof approvalCommentListResponseSchema>;
export type ApprovalCommentCreateRequest = z.infer<typeof approvalCommentCreateRequestSchema>;
export type ApprovalCommentCreateResponse = z.infer<typeof approvalCommentCreateResponseSchema>;
export type ApprovalCandidateListResponse = z.infer<typeof approvalCandidateListResponseSchema>;
export type ApprovalActionRequest = z.infer<typeof approvalActionRequestSchema>;
export type ApprovalActionResponse = z.infer<typeof approvalActionResponseSchema>;
export type MailBox = z.infer<typeof mailBoxSchema>;
export type MailRecipient = z.infer<typeof mailRecipientSchema>;
export type MailRecipientListResponse = z.infer<typeof mailRecipientListResponseSchema>;
export type MailMessage = z.infer<typeof mailMessageSchema>;
export type MailMessageListResponse = z.infer<typeof mailMessageListResponseSchema>;
export type MailMessageSendRequest = z.infer<typeof mailMessageSendRequestSchema>;
export type MailMessageSendResponse = z.infer<typeof mailMessageSendResponseSchema>;
export type MailMessageDraftSaveRequest = z.infer<typeof mailMessageDraftSaveRequestSchema>;
export type MailMessageDraftSaveResponse = z.infer<typeof mailMessageDraftSaveResponseSchema>;
export type MailMessageReadResponse = z.infer<typeof mailMessageReadResponseSchema>;
export type MailAttachment = z.infer<typeof mailAttachmentSchema>;
export type MailAttachmentListResponse = z.infer<typeof mailAttachmentListResponseSchema>;
export type MailAttachmentUploadResponse = z.infer<typeof mailAttachmentUploadResponseSchema>;
export type MailAttachmentDeleteResponse = z.infer<typeof mailAttachmentDeleteResponseSchema>;
export type Board = z.infer<typeof boardSchema>;
export type BoardPost = z.infer<typeof boardPostSchema>;
export type BoardComment = z.infer<typeof boardCommentSchema>;
export type NoticeListResponse = z.infer<typeof noticeListResponseSchema>;
export type BoardsListResponse = z.infer<typeof boardsListResponseSchema>;
export type BoardCreateRequest = z.infer<typeof boardCreateRequestSchema>;
export type BoardResponse = z.infer<typeof boardResponseSchema>;
export type BoardPostCreateRequest = z.infer<typeof boardPostCreateRequestSchema>;
export type BoardPostListResponse = z.infer<typeof boardPostListResponseSchema>;
export type BoardPostCreateResponse = z.infer<typeof boardPostCreateResponseSchema>;
export type BoardPostDetailResponse = z.infer<typeof boardPostDetailResponseSchema>;
export type BoardCommentCreateRequest = z.infer<typeof boardCommentCreateRequestSchema>;
export type BoardCommentListResponse = z.infer<typeof boardCommentListResponseSchema>;
export type BoardCommentCreateResponse = z.infer<typeof boardCommentCreateResponseSchema>;
export type DocumentSpace = z.infer<typeof documentSpaceSchema>;
export type DocumentFile = z.infer<typeof documentFileSchema>;
export type DocumentStorageProvider = z.infer<typeof documentStorageProviderSchema>;
export type DocumentStorageStatus = z.infer<typeof documentStorageStatusSchema>;
export type DocumentSpaceListResponse = z.infer<typeof documentSpaceListResponseSchema>;
export type DocumentSpaceCreateRequest = z.infer<typeof documentSpaceCreateRequestSchema>;
export type DocumentSpaceResponse = z.infer<typeof documentSpaceResponseSchema>;
export type DocumentFileListResponse = z.infer<typeof documentFileListResponseSchema>;
export type DocumentFileMetadataCreateRequest = z.infer<typeof documentFileMetadataCreateRequestSchema>;
export type DocumentFileMetadataCreateResponse = z.infer<typeof documentFileMetadataCreateResponseSchema>;
export type DocumentFileUploadInitRequest = z.infer<typeof documentFileUploadInitRequestSchema>;
export type DocumentFileAction = z.infer<typeof documentFileActionSchema>;
export type DocumentFileUploadInitResponse = z.infer<typeof documentFileUploadInitResponseSchema>;
export type DocumentFileUploadCompleteRequest = z.infer<typeof documentFileUploadCompleteRequestSchema>;
export type DocumentFileUploadCompleteResponse = z.infer<typeof documentFileUploadCompleteResponseSchema>;
export type DocumentFileDownloadInitResponse = z.infer<typeof documentFileDownloadInitResponseSchema>;
export type DocumentFileDeleteResponse = z.infer<typeof documentFileDeleteResponseSchema>;
export type ElectronicContractStatus = z.infer<typeof electronicContractStatusSchema>;
export type ElectronicContractPartyRole = z.infer<typeof electronicContractPartyRoleSchema>;
export type ElectronicContractPartyStatus = z.infer<typeof electronicContractPartyStatusSchema>;
export type ElectronicContractParty = z.infer<typeof electronicContractPartySchema>;
export type ElectronicContract = z.infer<typeof electronicContractSchema>;
export type ElectronicContractCreateRequest = z.infer<typeof electronicContractCreateRequestSchema>;
export type ElectronicContractStatusUpdateRequest = z.infer<typeof electronicContractStatusUpdateRequestSchema>;
export type ElectronicContractListResponse = z.infer<typeof electronicContractListResponseSchema>;
export type ElectronicContractDetailResponse = z.infer<typeof electronicContractDetailResponseSchema>;
export type ElectronicContractCreateResponse = z.infer<typeof electronicContractCreateResponseSchema>;
export type ElectronicContractStatusUpdateResponse = z.infer<typeof electronicContractStatusUpdateResponseSchema>;
export type ErpVendorStatus = z.infer<typeof erpVendorStatusSchema>;
export type ErpVendorSyncStatus = z.infer<typeof erpVendorSyncStatusSchema>;
export type ErpVendor = z.infer<typeof erpVendorSchema>;
export type ErpVendorCreateRequest = z.infer<typeof erpVendorCreateRequestSchema>;
export type ErpVendorUpdateRequest = z.infer<typeof erpVendorUpdateRequestSchema>;
export type ErpVendorStatusUpdateRequest = z.infer<typeof erpVendorStatusUpdateRequestSchema>;
export type ErpVendorListResponse = z.infer<typeof erpVendorListResponseSchema>;
export type ErpVendorMutationResponse = z.infer<typeof erpVendorMutationResponseSchema>;
export type ErpExpenseStatus = z.infer<typeof erpExpenseStatusSchema>;
export type ErpExpensePaymentMethod = z.infer<typeof erpExpensePaymentMethodSchema>;
export type ErpExpenseTaxType = z.infer<typeof erpExpenseTaxTypeSchema>;
export type ErpExpenseRequest = z.infer<typeof erpExpenseRequestSchema>;
export type ErpExpenseRequestCreateRequest = z.infer<typeof erpExpenseRequestCreateRequestSchema>;
export type ErpExpenseRequestUpdateRequest = z.infer<typeof erpExpenseRequestUpdateRequestSchema>;
export type ErpExpenseRequestStatusUpdateRequest = z.infer<typeof erpExpenseRequestStatusUpdateRequestSchema>;
export type ErpExpenseRequestListResponse = z.infer<typeof erpExpenseRequestListResponseSchema>;
export type ErpExpenseRequestMutationResponse = z.infer<typeof erpExpenseRequestMutationResponseSchema>;
export type ErpEvidenceType = z.infer<typeof erpEvidenceTypeSchema>;
export type ErpEvidenceStatus = z.infer<typeof erpEvidenceStatusSchema>;
export type ErpEvidence = z.infer<typeof erpEvidenceSchema>;
export type ErpEvidenceCreateRequest = z.infer<typeof erpEvidenceCreateRequestSchema>;
export type ErpEvidenceUpdateRequest = z.infer<typeof erpEvidenceUpdateRequestSchema>;
export type ErpEvidenceStatusUpdateRequest = z.infer<typeof erpEvidenceStatusUpdateRequestSchema>;
export type ErpEvidenceListResponse = z.infer<typeof erpEvidenceListResponseSchema>;
export type ErpEvidenceMutationResponse = z.infer<typeof erpEvidenceMutationResponseSchema>;
export type ErpBillingStatus = z.infer<typeof erpBillingStatusSchema>;
export type ErpBillingPaymentStatus = z.infer<typeof erpBillingPaymentStatusSchema>;
export type ErpBillingTaxInvoiceStatus = z.infer<typeof erpBillingTaxInvoiceStatusSchema>;
export type ErpBilling = z.infer<typeof erpBillingSchema>;
export type ErpBillingCreateRequest = z.infer<typeof erpBillingCreateRequestSchema>;
export type ErpBillingUpdateRequest = z.infer<typeof erpBillingUpdateRequestSchema>;
export type ErpBillingStatusUpdateRequest = z.infer<typeof erpBillingStatusUpdateRequestSchema>;
export type ErpBillingListResponse = z.infer<typeof erpBillingListResponseSchema>;
export type ErpBillingMutationResponse = z.infer<typeof erpBillingMutationResponseSchema>;
export type ErpPaymentDirection = z.infer<typeof erpPaymentDirectionSchema>;
export type ErpPaymentMethod = z.infer<typeof erpPaymentMethodSchema>;
export type ErpPaymentMatchStatus = z.infer<typeof erpPaymentMatchStatusSchema>;
export type ErpReceivableStatus = z.infer<typeof erpReceivableStatusSchema>;
export type ErpPaymentRecord = z.infer<typeof erpPaymentRecordSchema>;
export type ErpPaymentRecordCreateRequest = z.infer<typeof erpPaymentRecordCreateRequestSchema>;
export type ErpPaymentRecordUpdateRequest = z.infer<typeof erpPaymentRecordUpdateRequestSchema>;
export type ErpPaymentRecordStatusUpdateRequest = z.infer<typeof erpPaymentRecordStatusUpdateRequestSchema>;
export type ErpPaymentRecordListResponse = z.infer<typeof erpPaymentRecordListResponseSchema>;
export type ErpPaymentRecordMutationResponse = z.infer<typeof erpPaymentRecordMutationResponseSchema>;
export type ErpAccountSubjectType = z.infer<typeof erpAccountSubjectTypeSchema>;
export type ErpAccountSubjectStatus = z.infer<typeof erpAccountSubjectStatusSchema>;
export type ErpAccountSubject = z.infer<typeof erpAccountSubjectSchema>;
export type ErpAccountSubjectCreateRequest = z.infer<typeof erpAccountSubjectCreateRequestSchema>;
export type ErpAccountSubjectListResponse = z.infer<typeof erpAccountSubjectListResponseSchema>;
export type ErpAccountSubjectMutationResponse = z.infer<typeof erpAccountSubjectMutationResponseSchema>;
export type ErpJournalEntryStatus = z.infer<typeof erpJournalEntryStatusSchema>;
export type ErpJournalEntry = z.infer<typeof erpJournalEntrySchema>;
export type ErpJournalEntryCreateRequest = z.infer<typeof erpJournalEntryCreateRequestSchema>;
export type ErpJournalEntryStatusUpdateRequest = z.infer<typeof erpJournalEntryStatusUpdateRequestSchema>;
export type ErpJournalEntryListResponse = z.infer<typeof erpJournalEntryListResponseSchema>;
export type ErpJournalEntryMutationResponse = z.infer<typeof erpJournalEntryMutationResponseSchema>;
export type ErpLedgerEntry = z.infer<typeof erpLedgerEntrySchema>;
export type ErpLedgerSummary = z.infer<typeof erpLedgerSummarySchema>;
export type ErpLedgerEntryListResponse = z.infer<typeof erpLedgerEntryListResponseSchema>;
export type ErpClosingPeriodStatus = z.infer<typeof erpClosingPeriodStatusSchema>;
export type ErpClosingPeriod = z.infer<typeof erpClosingPeriodSchema>;
export type ErpClosingPeriodCreateRequest = z.infer<typeof erpClosingPeriodCreateRequestSchema>;
export type ErpClosingPeriodStatusUpdateRequest = z.infer<typeof erpClosingPeriodStatusUpdateRequestSchema>;
export type ErpClosingPeriodListResponse = z.infer<typeof erpClosingPeriodListResponseSchema>;
export type ErpClosingPeriodMutationResponse = z.infer<typeof erpClosingPeriodMutationResponseSchema>;
export type ErpTaxDocumentType = z.infer<typeof erpTaxDocumentTypeSchema>;
export type ErpTaxDocumentStatus = z.infer<typeof erpTaxDocumentStatusSchema>;
export type ErpTaxDocument = z.infer<typeof erpTaxDocumentSchema>;
export type ErpTaxDocumentCreateRequest = z.infer<typeof erpTaxDocumentCreateRequestSchema>;
export type ErpTaxDocumentListResponse = z.infer<typeof erpTaxDocumentListResponseSchema>;
export type ErpTaxDocumentMutationResponse = z.infer<typeof erpTaxDocumentMutationResponseSchema>;
export type ErpTaxReportPackageStatus = z.infer<typeof erpTaxReportPackageStatusSchema>;
export type ErpTaxReportPackage = z.infer<typeof erpTaxReportPackageSchema>;
export type ErpTaxReportPackageCreateRequest = z.infer<typeof erpTaxReportPackageCreateRequestSchema>;
export type ErpTaxReportPackageListResponse = z.infer<typeof erpTaxReportPackageListResponseSchema>;
export type ErpTaxReportPackageMutationResponse = z.infer<typeof erpTaxReportPackageMutationResponseSchema>;
export type ErpAccountingMappingType = z.infer<typeof erpAccountingMappingTypeSchema>;
export type ErpAccountingMappingStatus = z.infer<typeof erpAccountingMappingStatusSchema>;
export type ErpAccountingMappingRecordStatus = z.infer<typeof erpAccountingMappingRecordStatusSchema>;
export type ErpAccountingMapping = z.infer<typeof erpAccountingMappingSchema>;
export type ErpAccountingMappingCreateRequest = z.infer<typeof erpAccountingMappingCreateRequestSchema>;
export type ErpAccountingMappingUpdateRequest = z.infer<typeof erpAccountingMappingUpdateRequestSchema>;
export type ErpAccountingMappingStatusUpdateRequest = z.infer<typeof erpAccountingMappingStatusUpdateRequestSchema>;
export type ErpAccountingMappingListResponse = z.infer<typeof erpAccountingMappingListResponseSchema>;
export type ErpAccountingMappingMutationResponse = z.infer<typeof erpAccountingMappingMutationResponseSchema>;
export type ErpIntegrationEventDirection = z.infer<typeof erpIntegrationEventDirectionSchema>;
export type ErpIntegrationEventResourceType = z.infer<typeof erpIntegrationEventResourceTypeSchema>;
export type ErpIntegrationEventStatus = z.infer<typeof erpIntegrationEventStatusSchema>;
export type ErpIntegrationEvent = z.infer<typeof erpIntegrationEventSchema>;
export type ErpIntegrationEventCreateRequest = z.infer<typeof erpIntegrationEventCreateRequestSchema>;
export type ErpIntegrationEventUpdateRequest = z.infer<typeof erpIntegrationEventUpdateRequestSchema>;
export type ErpIntegrationEventStatusUpdateRequest = z.infer<typeof erpIntegrationEventStatusUpdateRequestSchema>;
export type ErpIntegrationEventListResponse = z.infer<typeof erpIntegrationEventListResponseSchema>;
export type ErpIntegrationEventMutationResponse = z.infer<typeof erpIntegrationEventMutationResponseSchema>;
export type VehicleOperationLogStatus = z.infer<typeof vehicleOperationLogStatusSchema>;
export type VehicleOperationPurpose = z.infer<typeof vehicleOperationPurposeSchema>;
export type VehicleFuelType = z.infer<typeof vehicleFuelTypeSchema>;
export type Vehicle = z.infer<typeof vehicleSchema>;
export type VehicleOperationLog = z.infer<typeof vehicleOperationLogSchema>;
export type VehicleOperationLogCreateRequest = z.infer<typeof vehicleOperationLogCreateRequestSchema>;
export type VehicleOperationLogUpdateRequest = z.infer<typeof vehicleOperationLogUpdateRequestSchema>;
export type VehicleListResponse = z.infer<typeof vehicleListResponseSchema>;
export type VehicleOperationLogListResponse = z.infer<typeof vehicleOperationLogListResponseSchema>;
export type VehicleOperationLogDetailResponse = z.infer<typeof vehicleOperationLogDetailResponseSchema>;
export type VehicleOperationLogMutationResponse = z.infer<typeof vehicleOperationLogMutationResponseSchema>;
export type WorkItemModule = z.infer<typeof workItemModuleSchema>;
export type WorkItemStatus = z.infer<typeof workItemStatusSchema>;
export type WorkItemPriority = z.infer<typeof workItemPrioritySchema>;
export type WorkItemViewerScope = z.infer<typeof workItemViewerScopeSchema>;
export type WorkItemCapability = z.infer<typeof workItemCapabilitySchema>;
export type WorkItemAssignee = z.infer<typeof workItemAssigneeSchema>;
export type WorkItemAccess = z.infer<typeof workItemAccessSchema>;
export type WorkItemTaxContext = z.infer<typeof workItemTaxContextSchema>;
export type WorkItem = z.infer<typeof workItemSchema>;
export type WorkItemDocument = z.infer<typeof workItemDocumentSchema>;
export type WorkItemAttachment = z.infer<typeof workItemAttachmentSchema>;
export type WorkItemReview = z.infer<typeof workItemReviewSchema>;
export type WorkItemDeadline = z.infer<typeof workItemDeadlineSchema>;
export type WorkItemAuditLog = z.infer<typeof workItemAuditLogSchema>;
export type WorkItemListResponse = z.infer<typeof workItemListResponseSchema>;
export type WorkItemDetailResponse = z.infer<typeof workItemDetailResponseSchema>;
export type WorkItemDocumentsResponse = z.infer<typeof workItemDocumentsResponseSchema>;
export type WorkItemAttachmentsResponse = z.infer<typeof workItemAttachmentsResponseSchema>;
export type WorkItemReviewsResponse = z.infer<typeof workItemReviewsResponseSchema>;
export type WorkItemDeadlinesResponse = z.infer<typeof workItemDeadlinesResponseSchema>;
export type PayrollPayType = z.infer<typeof payrollPayTypeSchema>;
export type PayrollPeriodStatus = z.infer<typeof payrollPeriodStatusSchema>;
export type PayrollLineItemClassification = z.infer<typeof payrollLineItemClassificationSchema>;
export type PayrollLineItemSource = z.infer<typeof payrollLineItemSourceSchema>;
export type PayrollReviewScope = z.infer<typeof payrollReviewScopeSchema>;
export type PayrollReviewStatus = z.infer<typeof payrollReviewStatusSchema>;
export type PayrollProfile = z.infer<typeof payrollProfileSchema>;
export type PayrollPeriod = z.infer<typeof payrollPeriodSchema>;
export type PayrollInputSnapshot = z.infer<typeof payrollInputSnapshotSchema>;
export type PayrollLineItem = z.infer<typeof payrollLineItemSchema>;
export type PayrollReviewStep = z.infer<typeof payrollReviewStepSchema>;
export type PayrollDraft = z.infer<typeof payrollDraftSchema>;
export type PayrollRoleGuidance = z.infer<typeof payrollRoleGuidanceSchema>;
export type PayrollProfileListResponse = z.infer<typeof payrollProfileListResponseSchema>;
export type PayrollOverviewResponse = z.infer<typeof payrollOverviewResponseSchema>;
export type PayrollPeriodDetailResponse = z.infer<typeof payrollPeriodDetailResponseSchema>;
export type PayrollMyPayslipResponse = z.infer<typeof payrollMyPayslipResponseSchema>;
export type ReadReceipt = z.infer<typeof readReceiptSchema>;
export type ReadReceiptCreateRequest = z.infer<typeof readReceiptCreateRequestSchema>;
export type ReadReceiptCreateResponse = z.infer<typeof readReceiptCreateResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
