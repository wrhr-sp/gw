import React, { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { adminUsersListResponseSchema, appRoutes, type AdminUsersListResponse } from "@gw/shared";

import { AdminUsersPageContent } from "./admin-users-page-content";
import { classifyAdminUsersLoadErrorKind } from "./load-error-kind";

function getUnavailableAdminUsersData(): Pick<AdminUsersListResponse["data"], "items" | "linkedScreens" | "companySettingsModel" | "audit"> {
  return {
    items: [],
    linkedScreens: [
      {
        category: "implementation",
        source: "/admin/users",
        title: "사원정보관리 데이터를 다시 확인해 주세요",
        description: "세션 또는 권한 문제로 실제 데이터를 불러오지 못해 조회 실패 안내만 표시합니다.",
      },
    ],
    companySettingsModel: {
      companyId: "unavailable",
      companyName: "조회 실패",
      policyStartPoint: "회사 기본 설정과 운영 데이터 연결은 조회 실패 안내만 표시합니다.",
      groups: [
        {
          id: "company_profile",
          title: "회사 기본 설정",
          summary: "조회 실패 상태에서는 실제 연결 정보를 다시 불러와야 합니다.",
          owner: "company admin",
          linkedRoutes: ["/org", "/admin"],
        },
        {
          id: "organization_people_access",
          title: "조직 / 사용자 / 권한",
          summary: "조회 실패 상태에서는 실제 사원정보관리 조회 모델을 다시 확인해야 합니다.",
          owner: "hr admin",
          linkedRoutes: ["/employees", "/admin/users"],
        },
        {
          id: "attendance_leave_work_policies",
          title: "근태 / 휴가 / 근무 정책",
          summary: "정책 연결 정보는 `/admin/policies` 조회 실패 안내로만 남깁니다.",
          owner: "ops admin",
          linkedRoutes: ["/attendance", "/leave", "/admin/policies"],
        },
        {
          id: "admin_operations",
          title: "운영 / 감사 / 예외 처리",
          summary: "감사 데이터와 승인 게이트는 관리자 화면에서 다시 확인해야 합니다.",
          owner: "audit admin",
          linkedRoutes: ["/admin/policies", "/admin/audit-logs"],
        },
      ],
      policyAxes: [
        {
          id: "attendance_registration",
          title: "출퇴근 허용 방식",
          summary: "조회 실패 상태에서는 실제 정책 축 대신 안내만 표시합니다.",
          priority: "company default → workplace → department → job type",
        },
        {
          id: "leave_work_policy",
          title: "휴가 / 근무 정책",
          summary: "조회 실패 상태에서는 실제 정책 축 대신 안내만 표시합니다.",
          priority: "employee request → manager review → admin policy review",
        },
        {
          id: "employee_policy_visibility",
          title: "직원 노출 규칙",
          summary: "조회 실패 상태에서는 실제 정책 축 대신 안내만 표시합니다.",
          priority: "직원 안전 조회 우선",
        },
      ],
      employeeVisibilityRules: [
        "조회 실패 상태에서는 직원 노출 규칙을 안내 문구로만 보여 줍니다.",
        "관리자 데이터는 실제 응답을 다시 불러와 확인해야 합니다.",
        "회사 scope 경계는 일반 화면에 그대로 유지합니다.",
      ],
      approvalGates: [
        { id: "attendance_tag_device", title: "태그 단말 연동", status: "approval_required", summary: "조회 실패 상태" },
        { id: "leave_payroll_sync", title: "휴가-급여 반영", status: "approval_required", summary: "조회 실패 상태" },
        { id: "approval_delivery", title: "결재 알림/발송", status: "approval_required", summary: "조회 실패 상태" },
        { id: "company_scope_ready", title: "회사 scope 확인", status: "ready", summary: "기본 상태" },
      ],
    },
    audit: {
      candidate: true,
      action: "admin.user.list.viewed.unavailable",
    },
  };
}

async function loadAdminUsersData(
  sessionToken: string | null,
): Promise<{
  adminUsers: Pick<AdminUsersListResponse["data"], "items" | "linkedScreens" | "companySettingsModel" | "audit"> | null;
  loadError: string | null;
  loadErrorKind: "error" | "offline" | null;
}> {
  if (!sessionToken) {
    return { adminUsers: null, loadError: "세션이 없어 사원정보관리 데이터를 불러올 수 없습니다.", loadErrorKind: "error" };
  }

  let response;
  try {
    const requestHeaders = await headers();
    const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost";
    const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
    response = await fetch(`${protocol}://${host}${appRoutes.admin.users}`, {
      headers: {
        cookie: `gw_session=${encodeURIComponent(sessionToken)}`,
      },
      cache: "no-store",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      adminUsers: null,
      loadError: `사원정보관리 데이터 재조회가 중단되었습니다: ${message}`,
      loadErrorKind: classifyAdminUsersLoadErrorKind(message),
    };
  }

  if (!response.ok) {
    return {
      adminUsers: null,
      loadError: `사원정보관리 데이터 API 응답이 ${response.status} 상태를 반환했습니다.`,
      loadErrorKind: classifyAdminUsersLoadErrorKind(`status ${response.status}`),
    };
  }

  const parsed = adminUsersListResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    return {
      adminUsers: null,
      loadError: "사원정보관리 데이터 응답 형식을 해석하지 못했습니다.",
      loadErrorKind: "error",
    };
  }

  return { adminUsers: parsed.data.data, loadError: null, loadErrorKind: null };
}

async function AdminUsersPageResolved({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("gw_session")?.value ?? null;
  const params = (await searchParams) ?? {};
  const actionMessage = typeof params.result === "string" ? params.result : null;
  const actionType = typeof params.actionType === "string" ? params.actionType : null;
  const focusMessage = typeof params.focus === "string" ? params.focus : null;
  const { adminUsers, loadError, loadErrorKind } = await loadAdminUsersData(sessionToken);

  return (
    <AdminUsersPageContent
      adminUsers={adminUsers ?? getUnavailableAdminUsersData()}
      actionMessage={actionMessage}
      loadError={loadError}
      loadErrorKind={loadErrorKind}
      actionType={actionType}
      focusMessage={focusMessage}
    />
  );
}

export default function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "test") {
    return <AdminUsersPageContent adminUsers={getUnavailableAdminUsersData()} actionMessage={null} loadError={null} />;
  }

  return (
    <Suspense fallback={<AdminUsersPageContent adminUsers={getUnavailableAdminUsersData()} actionMessage={null} loadError={null} />}>
      <AdminUsersPageResolved searchParams={searchParams} />
    </Suspense>
  );
}
