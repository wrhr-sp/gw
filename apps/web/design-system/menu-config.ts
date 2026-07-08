export type StandardMenuGroup = {
  id: string;
  label: string;
  items: Array<{ id: string; label: string; href?: string }>;
};

export const standardMenuGroups: StandardMenuGroup[] = [
  {
    id: "account-management",
    label: "계정관리",
    items: [
      { id: "account-list", label: "계정 목록" },
      { id: "employee-registration", label: "사원 등록" },
      { id: "permission-template", label: "권한 템플릿" },
      { id: "access-scope", label: "접근범위" },
      { id: "login-security", label: "로그인 보안" },
      { id: "audit-log", label: "감사로그" },
    ],
  },
  {
    id: "standard-patterns",
    label: "표준 화면 패턴",
    items: [
      { id: "list", label: "목록: PageHeader → FilterBar → DataTable → Pagination" },
      { id: "detail", label: "상세: PageHeader → SummaryCard → DetailSection → AttachmentPanel → AuditLogPanel" },
      { id: "write", label: "작성: PageHeader → FormSection → ActionButtonGroup → ConfirmDialog" },
    ],
  },
];
