import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { errorResponseSchema, appRoutes } from "@gw/shared";

import { AdminPageContent } from "./admin-page-content";
import { getAdminPageCardsForRole } from "./admin-page-access";
import { app } from "../api/src/app";
import { AdminUsersPageContent } from "./app/admin/users/admin-users-page-content";
import { adminMenuSections, adminPrimaryNav } from "./app/mobile-pwa-config";
import { classifyAdminUsersLoadErrorKind } from "./app/admin/users/load-error-kind";
import AdminPoliciesPage from "./app/admin/policies/page";
import AdminAuditLogsPage from "./app/admin/audit-logs/page";
import AttendancePage from "./app/attendance/page";
import ManagementSupportHrPage from "./app/management-support/hr/page";

function buildAdminUsersPreviewFixture(): any {
  return {
    items: [
      {
        userId: "user_admin_fixture",
        fullName: "관리자 테스트",
        email: "admin@example.com",
        departmentName: "운영팀",
        roleCodes: ["COMPANY_ADMIN"],
        highRiskPermissions: ["audit.read"],
        employmentStatus: "active",
        accountType: "admin",
        accountStatus: "active",
        mustChangePassword: true,
        twoFactorRequired: true,
        failedLoginCount: 0,
        activeSessionCount: 1,
        lastLoginAt: "2026-07-06T00:00:00.000Z",
        roleChangePreview: { currentRoleCodes: ["COMPANY_ADMIN"], nextRoleCodes: ["HR_ADMIN"], auditCandidate: true },
        statusChangePreview: { currentStatus: "active", nextStatus: "offboarded", reasonRequired: true },
      },
    ],
    linkedScreens: [
      {
        source: "/api/admin/users",
        category: "계정관리",
        title: "계정관리 검증",
        description: "DB 연결 후 운영자 read model을 확인합니다.",
      },
    ],
    companySettingsModel: {
      companyName: "위아히어",
      policyStartPoint: "관리자 승인 후 적용",
      groups: [
        {
          id: "group_ops",
          owner: "운영팀",
          title: "운영 계정",
          summary: "운영자 계정 검토",
          description: "운영자 계정 검토",
          linkedRoutes: ["/admin/users"],
        },
      ],
      policyAxes: [{ id: "axis_role", title: "역할", description: "role / permission 기준" }],
      employeeVisibilityRules: ["일반 조회와 운영 검토 책임 분리"],
    },
    audit: { action: "admin.user.list.viewed" },
  };
}

describe("Phase 55 admin account/rbac live usage", () => {
  it("keeps the admin sidebar scoped to administrator work only", () => {
    expect(adminMenuSections).toHaveLength(1);
    expect(adminMenuSections[0]?.title).toBe("관리자 업무");
    expect(adminPrimaryNav.map((item) => item.href)).toEqual([
      "/admin",
      "/admin/policies",
      "/admin/audit-logs",
    ]);
    expect(adminPrimaryNav.map((item) => item.label)).toEqual([
      "그룹웨어관리",
      "운영 정책",
      "감사로그",
    ]);
    expect(adminPrimaryNav.some((item) => item.href === "/mail" || item.href === "/messenger" || item.href === "/work-items/branch")).toBe(false);
  });

  it("turns the admin hub into an operations-first console", () => {
    const html = renderToStaticMarkup(
      <AdminPageContent visibleAdminHubCards={getAdminPageCardsForRole("COMPANY_ADMIN")} />,
    );

    expect(html).toContain("그룹웨어관리자");
    expect(html).toContain("관리자 기능");
    expect(html).not.toContain("사원정보관리");
    expect(html).not.toContain("권한 관리");
    expect(html).toContain("운영 정책");
    expect(html).toContain("감사로그");
    expect(html).not.toContain("관리자 업무 진입");
    expect(html).not.toContain("구현 범위");
    expect(html).not.toContain("관리자 페이지 분리 원칙");
  });

  it("shows only the routes each admin viewer is allowed to open from the hub cards", () => {
    expect(getAdminPageCardsForRole("HR_ADMIN").map((card) => card.href)).toEqual(["/admin/policies"]);
    expect(getAdminPageCardsForRole("AUDITOR").map((card) => card.href)).toEqual(["/admin/audit-logs"]);
    expect(getAdminPageCardsForRole("COMPANY_ADMIN").map((card) => card.href)).toEqual([
      "/admin/policies",
      "/admin/audit-logs",
    ]);
  });

  it("shows user review queues and audit-ready diffs before any save action", async () => {
    const loginResponse = await app.request(appRoutes.auth.login, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dev-role": "COMPANY_ADMIN",
      },
      body: JSON.stringify({
        loginId: "admin",
        password: "1234",
      }),
    });
    const cookie = loginResponse.headers.get("set-cookie");
    if (!cookie) {
      throw new Error("expected login response to include set-cookie header");
    }

    const 검증Response = await app.request(appRoutes.admin.users, {
      headers: {
        cookie,
      },
    });
    expect(검증Response.status).toBe(503);
    expect(errorResponseSchema.parse(await 검증Response.json()).error.code).toBe("DB_NOT_CONFIGURED");
    const 검증 = buildAdminUsersPreviewFixture();
    const html = renderToStaticMarkup(
      <AdminUsersPageContent
        adminUsers={검증}
        actionMessage="권한 변경점 검증 완료: 관리자 테스트 → HR_ADMIN (운영 DB 재조회 대상)"
        actionType="role"
        focusMessage="권한 변경점 검증 뒤 /management, /admin/users, /admin/audit-logs 접근 결과를 다시 눌러봅니다."
      />,
    );

    expect(html).toContain("사원 계정 관리");
    expect(html).toContain("계정 현황");
    expect(html).toContain("계정관리 목록");
    expect(html).toContain("계정 · 권한 상세");
    expect(html).toContain("기능별 권한");
    expect(html).toContain("퇴사");
    expect(html).toContain("관리자 작업");
    expect(html).toContain("권한 변경점 검증 뒤 /management, /admin/users, /admin/audit-logs 접근 결과를 다시 눌러봅니다.");
    expect(html).toContain("COMPANY_ADMIN");
    expect(html).toContain("고위험 권한: audit.read");
    expect(html).toContain("운영 DB 재조회 대상");
    expect(html).toContain("상태 저장");
    expect(html).toContain("역할 저장");
    expect(html).not.toContain("현재 사원 계정 목록");
    expect(html).not.toContain("관리자 설정 이관 기준");
    expect(html).not.toContain("역할 변경 후보: HR_ADMIN");
    expect(html).not.toContain("사원정보관리 구성 순서");
  });

  it("places employee information management inside management support HR, not admin users", () => {
    const supportHtml = renderToStaticMarkup(<ManagementSupportHrPage />);

    expect(supportHtml).toContain("인사관리");
    expect(supportHtml).toContain("사원정보관리");
    expect(supportHtml).toContain("사원 목록");
    expect(supportHtml).toContain("사원 등록 / 계정 생성");
    expect(supportHtml).toContain("사원 기본정보");
    expect(supportHtml).toContain("조직 / 지점 / 직무");
    expect(supportHtml).toContain("계정 / 역할 / 권한");
    expect(supportHtml).toContain("보안 설정");
    expect(supportHtml).toContain("근무 / 재직 상태");
    expect(supportHtml).toContain("인사 서류 / 계약");
    expect(supportHtml).toContain("근태 / 휴가 연결");
    expect(supportHtml).toContain("급여 연결");
    expect(supportHtml).toContain("업무 접근 / 포털 접근");
    expect(supportHtml).toContain("부서");
    expect(supportHtml).toContain("지점");
    expect(supportHtml).toContain("직책/직급");
    expect(supportHtml).toContain("사번");
    expect(supportHtml).toContain("입사일");
    expect(supportHtml).toContain("조직정보 저장");
    expect(supportHtml).toContain("계정상태 저장");
    expect(supportHtml).toContain("역할/권한 저장");
    expect(supportHtml).toContain("권한 요약");
    expect(supportHtml).toContain("보안 설정 저장");
    expect(supportHtml).toContain("2단계 인증");
    expect(supportHtml).toContain("활성 세션");
    expect(supportHtml).toContain("총괄관리자");
    expect(supportHtml).toContain("감사로그");
    expect(supportHtml).not.toContain("감사로그/변경이력은 관리자페이지 감사로그에서 확인합니다.");
    expect(supportHtml).not.toContain("감사로그 / 변경이력");
    expect(supportHtml).not.toContain("운영 DB 조회 결과에서 사원을 선택하면 실제 API 값 또는 연결 필요 상태를 표시합니다.");
    expect(supportHtml).not.toContain("선택 사원 조회 후 표시");
    expect(supportHtml).not.toContain("미구성 대기");
  });

  it("separates offline recovery copy from generic errors on the admin users page", async () => {
    const loginResponse = await app.request(appRoutes.auth.login, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dev-role": "COMPANY_ADMIN",
      },
      body: JSON.stringify({
        loginId: "admin",
        password: "1234",
      }),
    });
    const cookie = loginResponse.headers.get("set-cookie");
    if (!cookie) {
      throw new Error("expected login response to include set-cookie header");
    }

    const 검증Response = await app.request(appRoutes.admin.users, {
      headers: {
        cookie,
      },
    });
    expect(검증Response.status).toBe(503);
    expect(errorResponseSchema.parse(await 검증Response.json()).error.code).toBe("DB_NOT_CONFIGURED");
    const 검증 = buildAdminUsersPreviewFixture();
    const html = renderToStaticMarkup(
      <AdminUsersPageContent
        adminUsers={검증}
        loadErrorKind="offline"
        loadError="계정관리 검증 재조회가 중단되었습니다: network timeout"
      />,
    );

    expect(classifyAdminUsersLoadErrorKind("network timeout while fetching admin users")).toBe("offline");
    expect(classifyAdminUsersLoadErrorKind("네트워크 연결이 끊겼습니다")).toBe("offline");
    expect(classifyAdminUsersLoadErrorKind("응답 형식을 해석하지 못했습니다")).toBe("error");
    expect(html).toContain("네트워크 재확인 필요");
    expect(html).toContain("관리자 PWA 는 읽기 중심 확인만 일부 도와주며");
    expect(html).toContain("네트워크 연결을 다시 확인하고 `/admin` 에서 새로고침");
    expect(html).toContain("복구 경로: /admin · /admin/policies · /admin/audit-logs · /offline");
  });

  it("separates offline retry guidance from generic review errors on the admin users page", async () => {
    const loginResponse = await app.request(appRoutes.auth.login, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dev-role": "COMPANY_ADMIN",
      },
      body: JSON.stringify({
        loginId: "admin",
        password: "1234",
      }),
    });
    const cookie = loginResponse.headers.get("set-cookie");
    if (!cookie) {
      throw new Error("expected login response to include set-cookie header");
    }

    const 검증Response = await app.request(appRoutes.admin.users, {
      headers: {
        cookie,
      },
    });
    expect(검증Response.status).toBe(503);
    expect(errorResponseSchema.parse(await 검증Response.json()).error.code).toBe("DB_NOT_CONFIGURED");
    const 검증 = buildAdminUsersPreviewFixture();
    const html = renderToStaticMarkup(
      <AdminUsersPageContent
        adminUsers={검증}
        loadErrorKind="offline"
        loadError="네트워크 연결이 끊겨 계정관리 검증을 다시 불러오지 못했습니다."
      />,
    );

    expect(html).toContain("네트워크 재확인 필요");
    expect(html).toContain("네트워크 연결이 끊겨 계정관리 검증을 다시 불러오지 못했습니다.");
    expect(html).toContain("관리자 PWA 는 읽기 중심 확인만 일부 도와주며");
  });

  it("keeps policy review cards in a consistent current-candidate-capability format", () => {
    const html = renderToStaticMarkup(<AdminPoliciesPage />);

    expect(html).toContain("협업 화면과 운영 정책 화면의 경계");
    expect(html).toContain("/boards · /documents");
    expect(html).toContain("정책 카드 공통 형식");
    expect(html).toContain('id="policy-documents"');
    expect(html).toContain("현재 운영 기준");
    expect(html).toContain("candidate 변경안");
    expect(html).toContain("필요 capability");
    expect(html).toContain("감사 review");
    expect(html).toContain("문서 / 첨부 정책");
    expect(html).toContain("근태 / 출퇴근 등록 방식 정책");
    expect(html).toContain("현재 허용 방식");
    expect(html).toContain("candidate 허용 방식");
    expect(html).toContain("태그 단말 연동 승인 대기");
    expect(html).toContain("우선순위: 회사 기본 &lt; 근무지/지점 &lt; 부서/팀 &lt; 직무/역할");
    expect(html).toContain("예상 적용 인원 2명");
    expect(html).toContain("대상 직원 적용 현황");
    expect(html).toContain("동일 target 활성 정책 중복: 근무지/지점 · 원격 실험실");
  });

  it("shows employee attendance actions without exposing disallowed old mobile/PC labels", () => {
    const html = renderToStaticMarkup(<AttendancePage />);

    expect(html).toContain("오늘 근태");
    expect(html).not.toContain("허용 방식");
    expect(html).not.toContain("태그 · PC");
    expect(html).toContain("퇴근 등록");
    expect(html).not.toContain("모바일 출근 등록");
    expect(html).not.toContain("PC 출근 등록");
    expect(html).not.toContain("Phase");
  });

  it("keeps audit logs focused on filters, timeline, detail context, and masking boundaries", () => {
    const html = renderToStaticMarkup(<AdminAuditLogsPage />);

    expect(html).toContain("Phase 56 감사 read-only / audit.read 경계 확인");
    expect(html).toContain("감사 전용 진입 의미");
    expect(html).toContain("역할별 route/API guard 요약");
    expect(html).toContain("AUDITOR");
    expect(html).toContain("/admin/audit-logs: 허용");
    expect(html).toContain("/admin/users: 차단");
    expect(html).toContain("조회 필터");
    expect(html).toContain("최근 이벤트 타임라인");
    expect(html).toContain("상세 패널");
    expect(html).toContain("운영 최소 기준선");
    expect(html).toContain("RUNBOOK.md 와 DEPLOYMENT.md");
    expect(html).toContain("비노출/회사 경계");
    expect(html).toContain("raw storageKey / bucket / signed URL / public URL 전문은 감사 응답과 화면에 노출하지 않습니다.");
    expect(html).toContain("storageRef 는 fileId / spaceId / versionId / storageStatus 수준의 참조 요약입니다.");
  });
});
