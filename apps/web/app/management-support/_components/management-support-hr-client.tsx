"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  ActionButtonGroup,
  ConfirmDialog,
  DataTable,
  EmptyState,
  SummaryCard,
  StandardButton,
} from "../../_components/ui-standard";
import {
  adminUserCreateRequestSchema,
  adminUserMutationResponseSchema,
  adminUserOrganizationUpdateRequestSchema,
  adminUserProfileUpdateRequestSchema,
  adminUserRolesUpdateRequestSchema,
  adminUserSecurityUpdateRequestSchema,
  adminUserStatusUpdateRequestSchema,
  adminUsersListResponseSchema,
  appRoutes,
  errorResponseSchema,
  type AdminAccountStatus,
  type AdminAccountType,
  type AdminUserCreateRequest,
  type AdminUserOrganizationUpdateRequest,
  type AdminUserProfileUpdateRequest,
  type AdminUserRolesUpdateRequest,
  type AdminUserSecurityUpdateRequest,
  type AdminUserSummary,
  type AdminUsersSummaryCounts,
  type AdminUserStatusUpdateRequest,
  type RoleCode,
} from "@gw/shared";

const employeeInformationOrder = [
  "사원 목록",
  "사원 등록 / 계정 생성",
  "사원 기본정보",
  "조직 / 지점 / 직무",
  "계정 / 역할 / 권한",
  "보안 설정",
  "근무 / 재직 상태",
  "인사 서류 / 계약",
  "근태 / 휴가 연결",
  "급여 연결",
  "업무 접근 / 포털 접근",
] as const;

const roleLabels: Record<RoleCode, string> = {
  SUPER_ADMIN: "총괄관리자",
  COMPANY_ADMIN: "회사관리자",
  HR_ADMIN: "인사관리자",
  MANAGER: "관리자",
  EMPLOYEE: "사원",
  AUDITOR: "감사담당자",
};

const roleOptions = Object.entries(roleLabels) as Array<[RoleCode, string]>;

const internalEmployeeAccountTypeOptions: Array<{ value: AdminAccountType; label: string }> = [
  { value: "employee", label: "사내임직원" },
];

const createAccountStatusOptions: Array<{ value: AdminAccountStatus; label: string }> = [
  { value: "invited", label: "초대대기" },
  { value: "active", label: "활성" },
];

type EmployeeDetailPanelTab = "profile" | "organization" | "account" | "security";

const employeeDetailPanelTabs: Array<{ id: EmployeeDetailPanelTab; label: string }> = [
  { id: "profile", label: "기본정보" },
  { id: "organization", label: "조직정보" },
  { id: "account", label: "계정·권한" },
  { id: "security", label: "보안" },
];

const emptyCreateForm: AdminUserCreateRequest = {
  fullName: "",
  email: "",
  initialPassword: "",
  departmentName: "",
  branchName: "",
  positionName: "",
  accountType: "employee",
  roleCode: "EMPLOYEE",
  status: "invited",
  reason: "사내임직원 등록 및 계정 생성",
  mustChangePassword: true,
  mfaRequired: false,
};

const emptyAdminUsersSummary: AdminUsersSummaryCounts = {
  total: 0,
  active: 0,
  locked: 0,
  dormant: 0,
  offboarded: 0,
};

const accountStatusLabels: Record<AdminUserSummary["accountStatus"], string> = {
  invited: "초대대기",
  active: "활성",
  locked: "잠금",
  disabled: "비활성",
  offboarded: "퇴사처리",
  suspended: "일시정지",
};

const employmentStatusLabels: Record<AdminUserSummary["employmentStatus"], string> = {
  active: "재직",
  on_leave: "휴직",
  offboarded: "퇴사",
};

function roleText(roleCodes: readonly RoleCode[]) {
  return roleCodes.map((roleCode) => roleLabels[roleCode] ?? roleCode).join(", ");
}

function formatDate(value: string | null) {
  return value ? value.slice(0, 10) : "-";
}


const employeeLinkStatusLabels: Record<AdminUserSummary["employeeLinkStatus"], string> = {
  linked: "사원 연결됨",
  unlinked: "미연결",
  review_required: "검토",
};

const adminScopeLabels: Record<AdminUserSummary["adminScope"], string> = {
  global: "전체 관리 범위",
  company: "회사 관리 범위",
  audit: "감사 관리 범위",
};

type EmployeeDetailSection = {
  title: string;
  meta?: string;
  body?: string;
  status?: string;
};

function buildEmployeeDetailSections(selected: AdminUserSummary | null): EmployeeDetailSection[] {
  if (!selected) {
    return [];
  }

  return [
    {
      title: "기본정보",
      meta: `${selected.fullName} · ${selected.email}`,
      body: `${selected.departmentName} · ${selected.branchName}`,
    },
    {
      title: "조직 / 지점 / 직무",
      meta: `${selected.departmentName} · ${selected.branchName}`,
      body: `${selected.positionName ?? "직책/직급 미지정"} · ${selected.employeeNumber} · ${selected.hireDate ?? "입사일 미지정"}`,
    },
    {
      title: "계정 / 역할 / 권한",
      meta: roleText(selected.roleCodes),
      body: `고위험 권한: ${selected.highRiskPermissions.length > 0 ? selected.highRiskPermissions.join(", ") : "없음"}`,
      status: accountStatusLabels[selected.accountStatus],
    },
    {
      title: "보안 설정",
      meta: selected.mustChangePassword ? "최초 로그인 비밀번호 변경 필요" : "비밀번호 변경 요구 없음",
      body: `${selected.twoFactorRequired ? "2단계 인증 필요" : "2단계 인증 미요구"} · 실패 ${selected.failedLoginCount}회 · 세션 ${selected.activeSessionCount}개`,
      status: "계정 보안",
    },
    {
      title: "근무 / 재직 상태",
      meta: employmentStatusLabels[selected.employmentStatus],
      body: `계정 상태: ${accountStatusLabels[selected.accountStatus]} · 최근 로그인: ${formatDate(selected.lastLoginAt)}`,
    },
    {
      title: "인사 서류 / 계약",
    },
    {
      title: "근태 / 휴가 연결",
    },
    {
      title: "급여 연결",
    },
    {
      title: "업무 접근 / 포털 접근",
      meta: `${adminScopeLabels[selected.adminScope]} · ${employeeLinkStatusLabels[selected.employeeLinkStatus]}`,
    },
  ];
}

function EmployeeDetailSections({ selected }: { selected: AdminUserSummary | null }) {
  const sections = buildEmployeeDetailSections(selected);

  return (
    <div className="feature-workspace__rows" aria-label={selected ? `${selected.fullName} 사원 상세` : "사원 상세 섹션 기준"}>
      {sections.map((section) => (
        <article className="feature-workspace__row" key={section.title}>
          <div>
            <strong>{section.title}</strong>
            {section.meta ? <span>{section.meta}</span> : null}
            {section.body ? <p>{section.body}</p> : null}
          </div>
          {section.status ? <em>{section.status}</em> : null}
        </article>
      ))}
      <article className="feature-workspace__row">
        <div>
          <strong>감사로그</strong>
          <div className="feature-workspace__row-actions" aria-label="감사로그 이동">
            <Link className="feature-workspace__row-action feature-workspace__row-action--secondary" href="/admin/audit-logs">열기</Link>
          </div>
        </div>
      </article>
    </div>
  );
}

function buildErrorMessage(responseStatus: number, payload: unknown) {
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) {
    return `${parsed.data.error.code}: ${parsed.data.error.message}`;
  }
  return `사원정보를 불러오지 못했습니다. (${responseStatus})`;
}

type InitialAdminUsersData = {
  items: AdminUserSummary[];
  summary: AdminUsersSummaryCounts;
};

export function ManagementSupportHrClient({ initialData = null }: { initialData?: InitialAdminUsersData | null }) {
  const [items, setItems] = useState<AdminUserSummary[]>(() => initialData?.items ?? []);
  const [summary, setSummary] = useState<AdminUsersSummaryCounts>(() => initialData?.summary ?? emptyAdminUsersSummary);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "loaded" | "error">(() => initialData ? "loaded" : "idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(() => initialData?.items[0]?.userId ?? null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [activeDetailPanelTab, setActiveDetailPanelTab] = useState<EmployeeDetailPanelTab>("profile");
  const [profileForm, setProfileForm] = useState<AdminUserProfileUpdateRequest>({
    fullName: "",
    email: "",
    employmentStatus: "active",
    reason: "사원 기본정보 수정",
  });
  const [organizationForm, setOrganizationForm] = useState<AdminUserOrganizationUpdateRequest>({
    departmentName: "",
    branchName: "",
    positionName: "",
    employeeNumber: "",
    hireDate: "",
    reason: "사원 조직정보 수정",
  });
  const [accountForm, setAccountForm] = useState<AdminUserStatusUpdateRequest>({
    status: "active",
    mustChangePassword: false,
    reason: "사원 계정상태 수정",
  });
  const [rolesForm, setRolesForm] = useState<AdminUserRolesUpdateRequest>({
    roleCodes: ["EMPLOYEE"],
    reason: "사원 역할/권한 수정",
  });
  const [securityForm, setSecurityForm] = useState<AdminUserSecurityUpdateRequest>({
    twoFactorRequired: false,
    mustChangePassword: false,
    resetFailedLoginCount: false,
    revokeActiveSessions: false,
    reason: "사원 보안 설정 수정",
  });
  const [createForm, setCreateForm] = useState<AdminUserCreateRequest>(emptyCreateForm);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createSaveState, setCreateSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [createSaveMessage, setCreateSaveMessage] = useState<string | null>(null);
  const [profileSaveState, setProfileSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [profileSaveMessage, setProfileSaveMessage] = useState<string | null>(null);
  const [organizationSaveState, setOrganizationSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [organizationSaveMessage, setOrganizationSaveMessage] = useState<string | null>(null);
  const [accountSaveState, setAccountSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [accountSaveMessage, setAccountSaveMessage] = useState<string | null>(null);
  const [rolesSaveState, setRolesSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [rolesSaveMessage, setRolesSaveMessage] = useState<string | null>(null);
  const [securitySaveState, setSecuritySaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [securitySaveMessage, setSecuritySaveMessage] = useState<string | null>(null);
  const [deleteSaveState, setDeleteSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [deleteSaveMessage, setDeleteSaveMessage] = useState<string | null>(null);

  async function reloadAdminUsers(options?: { signal?: AbortSignal; selectedUserId?: string; silent?: boolean }) {
    if (!options?.silent) {
      setLoadState("loading");
      setErrorMessage(null);
    }

    const response = await fetch(appRoutes.admin.users, {
      cache: "no-store",
      credentials: "same-origin",
      signal: options?.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(buildErrorMessage(response.status, payload));
    }

    const parsed = adminUsersListResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error("사원정보를 불러오지 못했습니다.");
    }

    const adminUsersData = parsed.data.data as InitialAdminUsersData;
    setItems(adminUsersData.items);
    setSummary(adminUsersData.summary);
    setSelectedUserId((current) => options?.selectedUserId ?? current ?? adminUsersData.items[0]?.userId ?? null);
    setLoadState("loaded");
    return adminUsersData;
  }

  useEffect(() => {
    const controller = new AbortController();

    void reloadAdminUsers({ signal: controller.signal }).catch((error) => {
      if (controller.signal.aborted) return;
      setLoadState("error");
      setErrorMessage(error instanceof Error ? error.message : "사원정보를 불러오지 못했습니다.");
    });

    return () => controller.abort();
  }, []);

  const selected = useMemo(
    () => items.find((item) => item.userId === selectedUserId) ?? items[0] ?? null,
    [items, selectedUserId],
  );

  useEffect(() => {
    if (!selected) {
      return;
    }

    setProfileForm({
      fullName: selected.fullName,
      email: selected.email,
      employmentStatus: selected.employmentStatus,
      reason: "사원 기본정보 수정",
    });
    setProfileSaveState("idle");
    setProfileSaveMessage(null);
    setOrganizationForm({
      departmentName: selected.departmentName,
      branchName: selected.branchName,
      positionName: selected.positionName ?? "",
      employeeNumber: selected.employeeNumber,
      hireDate: selected.hireDate ?? "",
      reason: "사원 조직정보 수정",
    });
    setOrganizationSaveState("idle");
    setOrganizationSaveMessage(null);
    setAccountForm({
      status: selected.accountStatus,
      mustChangePassword: selected.mustChangePassword,
      reason: "사원 계정상태 수정",
    });
    setAccountSaveState("idle");
    setAccountSaveMessage(null);
    setRolesForm({
      roleCodes: selected.roleCodes,
      reason: "사원 역할/권한 수정",
    });
    setRolesSaveState("idle");
    setRolesSaveMessage(null);
    setSecurityForm({
      twoFactorRequired: selected.twoFactorRequired,
      mustChangePassword: selected.mustChangePassword,
      resetFailedLoginCount: false,
      revokeActiveSessions: false,
      reason: "사원 보안 설정 수정",
    });
    setSecuritySaveState("idle");
    setSecuritySaveMessage(null);
    setDeleteSaveState("idle");
    setDeleteSaveMessage(null);
  }, [selected?.userId, selected?.fullName, selected?.email, selected?.employmentStatus, selected?.departmentName, selected?.branchName, selected?.positionName, selected?.employeeNumber, selected?.hireDate, selected?.accountStatus, selected?.mustChangePassword, selected?.roleCodes, selected?.twoFactorRequired]);

  async function handleCreateSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedRequest = adminUserCreateRequestSchema.safeParse({
      ...createForm,
      accountType: "employee",
      positionName: createForm.positionName?.trim() ? createForm.positionName : undefined,
    });
    if (!parsedRequest.success) {
      setCreateSaveState("error");
      setCreateSaveMessage("이름, 이메일, 초기 비밀번호, 부서, 지점, 역할, 생성 사유를 확인해 주세요.");
      return;
    }

    setCreateSaveState("saving");
    setCreateSaveMessage(null);

    try {
      const response = await fetch(appRoutes.admin.userCreate, {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsedRequest.data),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(buildErrorMessage(response.status, payload));
      }

      const parsedResponse = adminUserMutationResponseSchema.safeParse(payload);
      if (!parsedResponse.success) {
        throw new Error("사내임직원 계정을 생성하지 못했습니다.");
      }

      const createdUser = parsedResponse.data.data.user;
      await reloadAdminUsers({ selectedUserId: createdUser.userId, silent: true });
      setCreateForm(emptyCreateForm);
      setIsCreateDialogOpen(false);
      setCreateSaveState("saved");
      setCreateSaveMessage(`${createdUser.fullName} 사내임직원 계정을 생성했습니다.`);
    } catch (error) {
      setCreateSaveState("error");
      setCreateSaveMessage(error instanceof Error ? error.message : "사내임직원 계정을 생성하지 못했습니다.");
    }
  }

  async function handleProfileSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      return;
    }

    const parsedRequest = adminUserProfileUpdateRequestSchema.safeParse(profileForm);
    if (!parsedRequest.success) {
      setProfileSaveState("error");
      setProfileSaveMessage("이름, 이메일, 재직상태, 변경 사유를 확인해 주세요.");
      return;
    }

    setProfileSaveState("saving");
    setProfileSaveMessage(null);

    try {
      const response = await fetch(appRoutes.admin.userProfile(selected.userId), {
        method: "PATCH",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsedRequest.data),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(buildErrorMessage(response.status, payload));
      }

      const parsedResponse = adminUserMutationResponseSchema.safeParse(payload);
      if (!parsedResponse.success) {
        throw new Error("사원 기본정보를 저장하지 못했습니다.");
      }

      const updatedUser = parsedResponse.data.data.user;
      await reloadAdminUsers({ selectedUserId: updatedUser.userId, silent: true });
      setProfileSaveState("saved");
      setProfileSaveMessage(`${updatedUser.fullName} 기본정보를 저장했습니다.`);
    } catch (error) {
      setProfileSaveState("error");
      setProfileSaveMessage(error instanceof Error ? error.message : "사원 기본정보를 저장하지 못했습니다.");
    }
  }

  async function handleOrganizationSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      return;
    }

    const parsedRequest = adminUserOrganizationUpdateRequestSchema.safeParse(organizationForm);
    if (!parsedRequest.success) {
      setOrganizationSaveState("error");
      setOrganizationSaveMessage("부서, 지점, 사번, 입사일, 변경 사유를 확인해 주세요.");
      return;
    }

    setOrganizationSaveState("saving");
    setOrganizationSaveMessage(null);

    try {
      const response = await fetch(appRoutes.admin.userOrganization(selected.userId), {
        method: "PATCH",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsedRequest.data),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(buildErrorMessage(response.status, payload));
      }

      const parsedResponse = adminUserMutationResponseSchema.safeParse(payload);
      if (!parsedResponse.success) {
        throw new Error("사원 조직정보를 저장하지 못했습니다.");
      }

      const updatedUser = parsedResponse.data.data.user;
      await reloadAdminUsers({ selectedUserId: updatedUser.userId, silent: true });
      setOrganizationSaveState("saved");
      setOrganizationSaveMessage(`${updatedUser.fullName} 조직정보를 저장했습니다.`);
    } catch (error) {
      setOrganizationSaveState("error");
      setOrganizationSaveMessage(error instanceof Error ? error.message : "사원 조직정보를 저장하지 못했습니다.");
    }
  }

  async function handleAccountSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      return;
    }

    const parsedRequest = adminUserStatusUpdateRequestSchema.safeParse(accountForm);
    if (!parsedRequest.success) {
      setAccountSaveState("error");
      setAccountSaveMessage("계정상태와 변경 사유를 확인해 주세요.");
      return;
    }

    setAccountSaveState("saving");
    setAccountSaveMessage(null);

    try {
      const response = await fetch(appRoutes.admin.userStatus(selected.userId), {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsedRequest.data),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(buildErrorMessage(response.status, payload));
      }

      const parsedResponse = adminUserMutationResponseSchema.safeParse(payload);
      if (!parsedResponse.success) {
        throw new Error("사원 계정상태를 저장하지 못했습니다.");
      }

      const updatedUser = parsedResponse.data.data.user;
      await reloadAdminUsers({ selectedUserId: updatedUser.userId, silent: true });
      setAccountSaveState("saved");
      setAccountSaveMessage(`${updatedUser.fullName} 계정상태를 저장했습니다.`);
    } catch (error) {
      setAccountSaveState("error");
      setAccountSaveMessage(error instanceof Error ? error.message : "사원 계정상태를 저장하지 못했습니다.");
    }
  }

  async function handleDeleteSelected() {
    if (!selected) {
      return;
    }

    setDeleteSaveState("saving");
    setDeleteSaveMessage(null);

    try {
      const response = await fetch(appRoutes.admin.userStatus(selected.userId), {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "offboarded",
          mustChangePassword: true,
          reason: "사원정보관리 현황카드 아래 삭제 버튼 처리",
        } satisfies AdminUserStatusUpdateRequest),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(buildErrorMessage(response.status, payload));
      }

      const parsedResponse = adminUserMutationResponseSchema.safeParse(payload);
      if (!parsedResponse.success) {
        throw new Error("사원 삭제 처리를 저장하지 못했습니다.");
      }

      const deletedUser = parsedResponse.data.data.user;
      await reloadAdminUsers({ selectedUserId: deletedUser.userId, silent: true });
      setDeleteSaveState("saved");
      setDeleteSaveMessage(`${deletedUser.fullName} 삭제 처리를 저장했습니다.`);
    } catch (error) {
      setDeleteSaveState("error");
      setDeleteSaveMessage(error instanceof Error ? error.message : "사원 삭제 처리를 저장하지 못했습니다.");
    }
  }

  async function handleRolesSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      return;
    }

    const parsedRequest = adminUserRolesUpdateRequestSchema.safeParse(rolesForm);
    if (!parsedRequest.success) {
      setRolesSaveState("error");
      setRolesSaveMessage("역할과 변경 사유를 확인해 주세요.");
      return;
    }

    setRolesSaveState("saving");
    setRolesSaveMessage(null);

    try {
      const response = await fetch(appRoutes.admin.userRoles(selected.userId), {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsedRequest.data),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(buildErrorMessage(response.status, payload));
      }

      const parsedResponse = adminUserMutationResponseSchema.safeParse(payload);
      if (!parsedResponse.success) {
        throw new Error("사원 역할/권한을 저장하지 못했습니다.");
      }

      const updatedUser = parsedResponse.data.data.user;
      await reloadAdminUsers({ selectedUserId: updatedUser.userId, silent: true });
      setRolesSaveState("saved");
      setRolesSaveMessage(`${updatedUser.fullName} 역할/권한을 저장했습니다.`);
    } catch (error) {
      setRolesSaveState("error");
      setRolesSaveMessage(error instanceof Error ? error.message : "사원 역할/권한을 저장하지 못했습니다.");
    }
  }

  async function handleSecuritySave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      return;
    }

    const parsedRequest = adminUserSecurityUpdateRequestSchema.safeParse(securityForm);
    if (!parsedRequest.success) {
      setSecuritySaveState("error");
      setSecuritySaveMessage("보안 설정과 변경 사유를 확인해 주세요.");
      return;
    }

    setSecuritySaveState("saving");
    setSecuritySaveMessage(null);

    try {
      const response = await fetch(appRoutes.admin.userSecurity(selected.userId), {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsedRequest.data),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(buildErrorMessage(response.status, payload));
      }

      const parsedResponse = adminUserMutationResponseSchema.safeParse(payload);
      if (!parsedResponse.success) {
        throw new Error("사원 보안 설정을 저장하지 못했습니다.");
      }

      const updatedUser = parsedResponse.data.data.user;
      await reloadAdminUsers({ selectedUserId: updatedUser.userId, silent: true });
      setSecurityForm((current) => ({ ...current, resetFailedLoginCount: false, revokeActiveSessions: false }));
      setSecuritySaveState("saved");
      setSecuritySaveMessage(`${updatedUser.fullName} 보안 설정을 저장했습니다.`);
    } catch (error) {
      setSecuritySaveState("error");
      setSecuritySaveMessage(error instanceof Error ? error.message : "사원 보안 설정을 저장하지 못했습니다.");
    }
  }

  const employeeTableColumns = useMemo<ColumnDef<AdminUserSummary>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: "이름",
        cell: ({ row }) => {
          const item = row.original;
          return (
            <button
              className="page-shell__title-link page-shell__title-button"
              onClick={() => {
                setSelectedUserId(item.userId);
                setActiveDetailPanelTab("profile");
                setIsDetailPanelOpen(true);
              }}
              type="button"
            >
              {item.fullName}
            </button>
          );
        },
      },
      {
        accessorKey: "email",
        header: "이메일",
      },
      {
        accessorKey: "departmentName",
        header: "부서",
      },
      {
        accessorKey: "branchName",
        header: "지점",
      },
      {
        accessorKey: "employmentStatus",
        header: "재직상태",
        cell: ({ row }) => employmentStatusLabels[row.original.employmentStatus],
      },
      {
        accessorKey: "accountStatus",
        header: "계정상태",
        cell: ({ row }) => accountStatusLabels[row.original.accountStatus],
      },
      {
        id: "roles",
        header: "역할",
        cell: ({ row }) => roleText(row.original.roleCodes),
      },
      {
        accessorKey: "lastLoginAt",
        header: "최근 로그인",
        cell: ({ row }) => formatDate(row.original.lastLoginAt),
      },
    ],
    [],
  );

  const employeeTable = useReactTable({
    columns: employeeTableColumns,
    data: items,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalCount = summary.total;
  const activeCount = summary.active;
  const lockedCount = summary.locked;
  const dormantCount = summary.dormant;
  const offboardedCount = summary.offboarded;

  return (
    <div className="feature-workspace">
      <aside className="feature-workspace__nav" aria-label="인사관리 메뉴">
        <div className="feature-workspace__nav-header">
          <h1>인사관리</h1>
        </div>
        <div className="feature-workspace__tab-list" role="tablist" aria-label="인사관리 화면 선택">
          <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button">
            <span>사원정보관리</span>
          </button>
          <button aria-selected="false" className="feature-workspace__tab" disabled role="tab" type="button">
            <span>인사발령</span>
          </button>
          <button aria-selected="false" className="feature-workspace__tab" disabled role="tab" type="button">
            <span>휴면계정관리</span>
          </button>
        </div>
      </aside>

      <section className="feature-workspace__panel" aria-labelledby="support-employee-info-heading">
        <div className="feature-workspace__panel-header">
          <div>
            <h2 id="support-employee-info-heading">사원정보관리</h2>
          </div>
        </div>

        <div className="feature-workspace__status-grid feature-workspace__status-grid--employee-summary" aria-label="사원정보관리 현황">
          <SummaryCard title="전체" value={`${totalCount}명`} tone="info" />
          <SummaryCard title="재직" value={`${activeCount}명`} tone="success" />
          <SummaryCard title="잠금" value={`${lockedCount}명`} tone="warning" />
          <SummaryCard title="휴면" value={`${dormantCount}명`} tone="warning" />
          <SummaryCard title="퇴사" value={`${offboardedCount}명`} tone="danger" />
        </div>

        <ActionButtonGroup label="사원정보관리 현황 작업">
          <StandardButton
            intent="primary"
            disabled={createSaveState === "saving"}
            onClick={() => {
              setCreateSaveState("idle");
              setCreateSaveMessage(null);
              setIsCreateDialogOpen(true);
            }}
            type="button"
          >
            등록
          </StandardButton>
          <StandardButton
            intent="danger"
            disabled={!selected || deleteSaveState === "saving" || selected.accountStatus === "offboarded" || selected.employmentStatus === "offboarded"}
            onClick={handleDeleteSelected}
            type="button"
          >
            {deleteSaveState === "saving" ? "삭제 처리 중" : "삭제"}
          </StandardButton>
          {deleteSaveMessage ? (
            <p className="feature-workspace__save-message" role={deleteSaveState === "error" ? "alert" : "status"}>
              {deleteSaveMessage}
            </p>
          ) : null}
        </ActionButtonGroup>

        {errorMessage ? (
          <EmptyState title="사원정보 조회 실패">
            <p role="alert">{errorMessage}</p>
          </EmptyState>
        ) : null}

        {isCreateDialogOpen ? (
          <div className="topbar-modal-backdrop" role="presentation">
            <ConfirmDialog
              title="사내임직원 등록"
              titleId="employee-create-dialog-heading"
              className="feature-workspace__create-dialog"
              closeButton={(
                <StandardButton
                  aria-label="사내임직원 등록 팝업 닫기"
                  disabled={createSaveState === "saving"}
                  intent="ghost"
                  onClick={() => setIsCreateDialogOpen(false)}
                  type="button"
                >
                  ×
                </StandardButton>
              )}
              actions={(
                <>
                  <StandardButton
                    disabled={createSaveState === "saving"}
                    intent="ghost"
                    onClick={() => setIsCreateDialogOpen(false)}
                    type="button"
                  >
                    닫기
                  </StandardButton>
                  <StandardButton
                    disabled={createSaveState === "saving"}
                    form="employee-create-form"
                    intent="primary"
                    type="submit"
                  >
                    {createSaveState === "saving" ? "생성 중" : "사내임직원 계정 생성"}
                  </StandardButton>
                </>
              )}
            >
              <form
                id="employee-create-form"
                className="feature-workspace__form feature-workspace__create-dialog-grid"
                onSubmit={handleCreateSave}
                aria-label="사내임직원 등록 및 계정 생성"
              >
                <label>
                  <span>이름</span>
                  <input
                    aria-label="사내임직원 이름"
                    disabled={createSaveState === "saving"}
                    minLength={2}
                    onChange={(event) => setCreateForm((current) => ({ ...current, fullName: event.target.value }))}
                    required
                    value={createForm.fullName}
                  />
                </label>
                <label>
                  <span>로그인 ID / 이메일</span>
                  <input
                    aria-label="사내임직원 로그인 ID 또는 이메일"
                    disabled={createSaveState === "saving"}
                    onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
                    required
                    type="email"
                    value={createForm.email}
                  />
                </label>
                <label>
                  <span>초기 비밀번호</span>
                  <input
                    aria-label="사내임직원 초기 비밀번호"
                    disabled={createSaveState === "saving"}
                    minLength={8}
                    onChange={(event) => setCreateForm((current) => ({ ...current, initialPassword: event.target.value }))}
                    required
                    type="password"
                    value={createForm.initialPassword}
                  />
                </label>
                <label>
                  <span>부서</span>
                  <input
                    aria-label="사내임직원 부서"
                    disabled={createSaveState === "saving"}
                    onChange={(event) => setCreateForm((current) => ({ ...current, departmentName: event.target.value }))}
                    required
                    value={createForm.departmentName}
                  />
                </label>
                <label>
                  <span>지점</span>
                  <input
                    aria-label="사내임직원 지점"
                    disabled={createSaveState === "saving"}
                    onChange={(event) => setCreateForm((current) => ({ ...current, branchName: event.target.value }))}
                    required
                    value={createForm.branchName}
                  />
                </label>
                <label>
                  <span>직책/직급</span>
                  <input
                    aria-label="사내임직원 직책 또는 직급"
                    disabled={createSaveState === "saving"}
                    onChange={(event) => setCreateForm((current) => ({ ...current, positionName: event.target.value }))}
                    value={createForm.positionName ?? ""}
                  />
                </label>
                <label>
                  <span>계정 유형</span>
                  <select aria-label="사내임직원 계정 유형" disabled value={createForm.accountType}>
                    {internalEmployeeAccountTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>초기 역할</span>
                  <select
                    aria-label="사내임직원 초기 역할"
                    disabled={createSaveState === "saving"}
                    onChange={(event) => setCreateForm((current) => ({ ...current, roleCode: event.target.value as RoleCode }))}
                    value={createForm.roleCode}
                  >
                    {roleOptions.map(([roleCode, label]) => (
                      <option key={roleCode} value={roleCode}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>초기 상태</span>
                  <select
                    aria-label="사내임직원 초기 상태"
                    disabled={createSaveState === "saving"}
                    onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as AdminAccountStatus }))}
                    value={createForm.status}
                  >
                    {createAccountStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>생성 사유</span>
                  <input
                    aria-label="사내임직원 계정 생성 사유"
                    disabled={createSaveState === "saving"}
                    minLength={1}
                    onChange={(event) => setCreateForm((current) => ({ ...current, reason: event.target.value }))}
                    required
                    value={createForm.reason}
                  />
                </label>
                <label>
                  <span>비밀번호 변경</span>
                  <select
                    aria-label="사내임직원 최초 로그인 비밀번호 변경 요구"
                    disabled={createSaveState === "saving"}
                    onChange={(event) => setCreateForm((current) => ({ ...current, mustChangePassword: event.target.value === "true" }))}
                    value={createForm.mustChangePassword ? "true" : "false"}
                  >
                    <option value="true">요구</option>
                    <option value="false">요구 안 함</option>
                  </select>
                </label>
                <label>
                  <span>2단계 인증</span>
                  <select
                    aria-label="사내임직원 2단계 인증 요구"
                    disabled={createSaveState === "saving"}
                    onChange={(event) => setCreateForm((current) => ({ ...current, mfaRequired: event.target.value === "true" }))}
                    value={createForm.mfaRequired ? "true" : "false"}
                  >
                    <option value="false">요구 안 함</option>
                    <option value="true">요구</option>
                  </select>
                </label>
                {createSaveMessage ? (
                  <p className="feature-workspace__save-message" role={createSaveState === "error" ? "alert" : "status"}>
                    {createSaveMessage}
                  </p>
                ) : null}
              </form>
            </ConfirmDialog>
          </div>
        ) : null}

        <DataTable label="사원 목록">
          <div className="employee-management-table-wrap" data-table-engine="tanstack">
          <table className="employee-management-table">
            <thead>
              {employeeTable.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} scope="col">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {employeeTable.getRowModel().rows.map((row) => (
                <tr key={row.id} data-selected={row.original.userId === selected?.userId ? "true" : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </DataTable>

        {items.length === 0 && loadState !== "loading" ? (
          <EmptyState title="조회된 사원이 없습니다" />
        ) : null}

        {isDetailPanelOpen && selected ? (
          <aside className="employee-detail-panel" aria-label={`${selected.fullName} 사원 우측 상세패널`}>
            <div className="employee-detail-panel__header">
              <div>
                <strong>{selected.fullName}</strong>
                <span>{selected.email}</span>
              </div>
              <StandardButton
                aria-label="사원 상세패널 닫기"
                intent="ghost"
                onClick={() => setIsDetailPanelOpen(false)}
                type="button"
              >
                ×
              </StandardButton>
            </div>
            <div className="employee-detail-panel__tabs" role="tablist" aria-label="사원 상세패널 입력 항목">
              {employeeDetailPanelTabs.map((tab) => (
                <StandardButton
                  key={tab.id}
                  aria-controls={`employee-detail-panel-${tab.id}`}
                  aria-selected={activeDetailPanelTab === tab.id}
                  className="employee-detail-panel__tab"
                  id={`employee-detail-panel-tab-${tab.id}`}
                  intent={activeDetailPanelTab === tab.id ? "primary" : "secondary"}
                  onClick={() => setActiveDetailPanelTab(tab.id)}
                  role="tab"
                  type="button"
                >
                  {tab.label}
                </StandardButton>
              ))}
            </div>
            <div className="employee-detail-panel__body">
            {activeDetailPanelTab === "profile" ? (
            <form
              className="feature-workspace__form"
              id="employee-detail-panel-profile"
              onSubmit={handleProfileSave}
              aria-label="사원 기본정보 수정"
              aria-labelledby="employee-detail-panel-tab-profile"
              role="tabpanel"
            >
              <label>
                <span>이름</span>
                <input
                  aria-label="사원 이름"
                  disabled={!selected || profileSaveState === "saving"}
                  onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))}
                  value={profileForm.fullName}
                />
              </label>
              <label>
                <span>이메일</span>
                <input
                  aria-label="사원 이메일"
                  disabled={!selected || profileSaveState === "saving"}
                  onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
                  type="email"
                  value={profileForm.email}
                />
              </label>
              <label>
                <span>재직상태</span>
                <select
                  aria-label="사원 재직상태"
                  disabled={!selected || profileSaveState === "saving"}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      employmentStatus: event.target.value as AdminUserProfileUpdateRequest["employmentStatus"],
                    }))
                  }
                  value={profileForm.employmentStatus}
                >
                  <option value="active">재직</option>
                  <option value="on_leave">휴직</option>
                  <option value="offboarded">퇴사</option>
                </select>
              </label>
              <label>
                <span>변경 사유</span>
                <input
                  aria-label="사원 기본정보 변경 사유"
                  disabled={!selected || profileSaveState === "saving"}
                  onChange={(event) => setProfileForm((current) => ({ ...current, reason: event.target.value }))}
                  value={profileForm.reason}
                />
              </label>
              <ActionButtonGroup>
                <StandardButton intent="primary" disabled={!selected || profileSaveState === "saving"} type="submit">
                  {profileSaveState === "saving" ? "저장 중" : "기본정보 저장"}
                </StandardButton>
              </ActionButtonGroup>
              {profileSaveMessage ? (
                <p className="feature-workspace__save-message" role={profileSaveState === "error" ? "alert" : "status"}>
                  {profileSaveMessage}
                </p>
              ) : null}
            </form>
            ) : null}
            
            {activeDetailPanelTab === "organization" ? (
            <form
              className="feature-workspace__form"
              id="employee-detail-panel-organization"
              onSubmit={handleOrganizationSave}
              aria-label="사원 조직정보 수정"
              aria-labelledby="employee-detail-panel-tab-organization"
              role="tabpanel"
            >
              <label>
                <span>부서</span>
                <input
                  aria-label="사원 부서"
                  disabled={!selected || organizationSaveState === "saving"}
                  onChange={(event) => setOrganizationForm((current) => ({ ...current, departmentName: event.target.value }))}
                  value={organizationForm.departmentName}
                />
              </label>
              <label>
                <span>지점</span>
                <input
                  aria-label="사원 지점"
                  disabled={!selected || organizationSaveState === "saving"}
                  onChange={(event) => setOrganizationForm((current) => ({ ...current, branchName: event.target.value }))}
                  value={organizationForm.branchName}
                />
              </label>
              <label>
                <span>직책/직급</span>
                <input
                  aria-label="사원 직책 또는 직급"
                  disabled={!selected || organizationSaveState === "saving"}
                  onChange={(event) => setOrganizationForm((current) => ({ ...current, positionName: event.target.value }))}
                  value={organizationForm.positionName ?? ""}
                />
              </label>
              <label>
                <span>사번</span>
                <input
                  aria-label="사원 사번"
                  disabled={!selected || organizationSaveState === "saving"}
                  onChange={(event) => setOrganizationForm((current) => ({ ...current, employeeNumber: event.target.value }))}
                  value={organizationForm.employeeNumber}
                />
              </label>
              <label>
                <span>입사일</span>
                <input
                  aria-label="사원 입사일"
                  disabled={!selected || organizationSaveState === "saving"}
                  onChange={(event) => setOrganizationForm((current) => ({ ...current, hireDate: event.target.value }))}
                  type="date"
                  value={organizationForm.hireDate}
                />
              </label>
              <label>
                <span>변경 사유</span>
                <input
                  aria-label="사원 조직정보 변경 사유"
                  disabled={!selected || organizationSaveState === "saving"}
                  onChange={(event) => setOrganizationForm((current) => ({ ...current, reason: event.target.value }))}
                  value={organizationForm.reason}
                />
              </label>
              <ActionButtonGroup>
                <StandardButton intent="primary" disabled={!selected || organizationSaveState === "saving"} type="submit">
                  {organizationSaveState === "saving" ? "저장 중" : "조직정보 저장"}
                </StandardButton>
              </ActionButtonGroup>
              {organizationSaveMessage ? (
                <p className="feature-workspace__save-message" role={organizationSaveState === "error" ? "alert" : "status"}>
                  {organizationSaveMessage}
                </p>
              ) : null}
            </form>
            ) : null}
            
            {activeDetailPanelTab === "account" ? (
            <div
              className="employee-detail-panel__tab-panel"
              id="employee-detail-panel-account"
              aria-labelledby="employee-detail-panel-tab-account"
              role="tabpanel"
            >
            <form className="feature-workspace__form" onSubmit={handleAccountSave} aria-label="사원 계정상태 수정">
              <label>
                <span>계정상태</span>
                <select
                  aria-label="사원 계정상태"
                  disabled={!selected || accountSaveState === "saving"}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      status: event.target.value as AdminUserStatusUpdateRequest["status"],
                    }))
                  }
                  value={accountForm.status}
                >
                  <option value="invited">초대대기</option>
                  <option value="active">활성</option>
                  <option value="locked">잠금</option>
                  <option value="disabled">비활성</option>
                  <option value="offboarded">퇴사처리</option>
                  <option value="suspended">일시정지</option>
                </select>
              </label>
              <label>
                <span>비밀번호 변경</span>
                <select
                  aria-label="최초 로그인 비밀번호 변경 요구"
                  disabled={!selected || accountSaveState === "saving"}
                  onChange={(event) => setAccountForm((current) => ({ ...current, mustChangePassword: event.target.value === "true" }))}
                  value={accountForm.mustChangePassword ? "true" : "false"}
                >
                  <option value="false">요구 안 함</option>
                  <option value="true">요구</option>
                </select>
              </label>
              <label>
                <span>변경 사유</span>
                <input
                  aria-label="사원 계정상태 변경 사유"
                  disabled={!selected || accountSaveState === "saving"}
                  onChange={(event) => setAccountForm((current) => ({ ...current, reason: event.target.value }))}
                  value={accountForm.reason}
                />
              </label>
              <ActionButtonGroup>
                <StandardButton intent="primary" disabled={!selected || accountSaveState === "saving"} type="submit">
                  {accountSaveState === "saving" ? "저장 중" : "계정상태 저장"}
                </StandardButton>
              </ActionButtonGroup>
              {accountSaveMessage ? (
                <p className="feature-workspace__save-message" role={accountSaveState === "error" ? "alert" : "status"}>
                  {accountSaveMessage}
                </p>
              ) : null}
            </form>
            
            <form className="feature-workspace__form" onSubmit={handleRolesSave} aria-label="사원 역할 권한 수정">
              {roleOptions.map(([roleCode, label]) => (
                <label key={roleCode}>
                  <span>{label}</span>
                  <select
                    aria-label={`${label} 역할 선택`}
                    disabled={!selected || rolesSaveState === "saving"}
                    onChange={(event) =>
                      setRolesForm((current) => {
                        const nextRoleCodes = event.target.value === "true"
                          ? [...new Set([...current.roleCodes, roleCode])]
                          : current.roleCodes.filter((currentRoleCode) => currentRoleCode !== roleCode);
                        return { ...current, roleCodes: nextRoleCodes.length > 0 ? nextRoleCodes : current.roleCodes };
                      })
                    }
                    value={rolesForm.roleCodes.includes(roleCode) ? "true" : "false"}
                  >
                    <option value="false">제외</option>
                    <option value="true">포함</option>
                  </select>
                </label>
              ))}
              <label>
                <span>권한 요약</span>
                <input aria-label="사원 권한 요약" readOnly value={selected ? `${selected.permissions.length}개 권한 · 고위험 ${selected.highRiskPermissions.length}개` : ""} />
              </label>
              <label>
                <span>변경 사유</span>
                <input
                  aria-label="사원 역할 권한 변경 사유"
                  disabled={!selected || rolesSaveState === "saving"}
                  onChange={(event) => setRolesForm((current) => ({ ...current, reason: event.target.value }))}
                  value={rolesForm.reason}
                />
              </label>
              <ActionButtonGroup>
                <StandardButton intent="primary" disabled={!selected || rolesSaveState === "saving"} type="submit">
                  {rolesSaveState === "saving" ? "저장 중" : "역할/권한 저장"}
                </StandardButton>
              </ActionButtonGroup>
              {rolesSaveMessage ? (
                <p className="feature-workspace__save-message" role={rolesSaveState === "error" ? "alert" : "status"}>
                  {rolesSaveMessage}
                </p>
              ) : null}
            </form>
            </div>
            ) : null}
            
            {activeDetailPanelTab === "security" ? (
            <form
              className="feature-workspace__form"
              id="employee-detail-panel-security"
              onSubmit={handleSecuritySave}
              aria-label="사원 보안 설정 수정"
              aria-labelledby="employee-detail-panel-tab-security"
              role="tabpanel"
            >
              <label>
                <span>2단계 인증</span>
                <select
                  aria-label="사원 2단계 인증 요구"
                  disabled={!selected || securitySaveState === "saving"}
                  onChange={(event) => setSecurityForm((current) => ({ ...current, twoFactorRequired: event.target.value === "true" }))}
                  value={securityForm.twoFactorRequired ? "true" : "false"}
                >
                  <option value="false">요구 안 함</option>
                  <option value="true">요구</option>
                </select>
              </label>
              <label>
                <span>비밀번호 변경</span>
                <select
                  aria-label="보안 설정 비밀번호 변경 요구"
                  disabled={!selected || securitySaveState === "saving"}
                  onChange={(event) => setSecurityForm((current) => ({ ...current, mustChangePassword: event.target.value === "true" }))}
                  value={securityForm.mustChangePassword ? "true" : "false"}
                >
                  <option value="false">요구 안 함</option>
                  <option value="true">요구</option>
                </select>
              </label>
              <label>
                <span>로그인 실패</span>
                <select
                  aria-label="로그인 실패 횟수 초기화"
                  disabled={!selected || securitySaveState === "saving"}
                  onChange={(event) => setSecurityForm((current) => ({ ...current, resetFailedLoginCount: event.target.value === "true" }))}
                  value={securityForm.resetFailedLoginCount ? "true" : "false"}
                >
                  <option value="false">유지</option>
                  <option value="true">초기화</option>
                </select>
              </label>
              <label>
                <span>활성 세션</span>
                <select
                  aria-label="활성 세션 종료"
                  disabled={!selected || securitySaveState === "saving"}
                  onChange={(event) => setSecurityForm((current) => ({ ...current, revokeActiveSessions: event.target.value === "true" }))}
                  value={securityForm.revokeActiveSessions ? "true" : "false"}
                >
                  <option value="false">유지</option>
                  <option value="true">종료</option>
                </select>
              </label>
              <label>
                <span>현재 보안 상태</span>
                <input aria-label="현재 보안 상태" readOnly value={selected ? `실패 ${selected.failedLoginCount}회 · 세션 ${selected.activeSessionCount}개 · 최근 로그인 ${formatDate(selected.lastLoginAt)}` : ""} />
              </label>
              <label>
                <span>변경 사유</span>
                <input
                  aria-label="사원 보안 설정 변경 사유"
                  disabled={!selected || securitySaveState === "saving"}
                  onChange={(event) => setSecurityForm((current) => ({ ...current, reason: event.target.value }))}
                  value={securityForm.reason}
                />
              </label>
              <ActionButtonGroup>
                <StandardButton intent="primary" disabled={!selected || securitySaveState === "saving"} type="submit">
                  {securitySaveState === "saving" ? "저장 중" : "보안 설정 저장"}
                </StandardButton>
              </ActionButtonGroup>
              {securitySaveMessage ? (
                <p className="feature-workspace__save-message" role={securitySaveState === "error" ? "alert" : "status"}>
                  {securitySaveMessage}
                </p>
              ) : null}
            </form>
            ) : null}
            </div>
          </aside>
        ) : null}

      </section>
    </div>
  );
}
