import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { errorResponseSchema, appRoutes } from "@gw/shared";

import { AdminPageContent } from "./admin-page-content";
import { getAdminPageCardsForRole } from "./admin-page-access";
import { app } from "../api/src/app";
import { AdminUsersPageContent } from "./app/admin/users/admin-users-page-content";
import { classifyAdminUsersLoadErrorKind } from "./app/admin/users/load-error-kind";
import AdminPoliciesPage from "./app/admin/policies/page";
import AdminAuditLogsPage from "./app/admin/audit-logs/page";
import AttendancePage from "./app/attendance/page";

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
        roleChangePreview: { nextRoleCodes: ["HR_ADMIN"] },
        statusChangePreview: { nextStatus: "offboarded" },
      },
    ],
    linkedScreens: [
      {
        source: "/api/admin/users",
        category: "계정관리",
        title: "계정관리 preview",
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
  it("turns the admin hub into an operations-first console", () => {
    const html = renderToStaticMarkup(
      <AdminPageContent visibleAdminHubCards={getAdminPageCardsForRole("COMPANY_ADMIN")} />,
    );

    expect(html).toContain("운영 검토 순서");
    expect(html).toContain("오늘 먼저 볼 운영 체크포인트");
    expect(html).toContain("권한별 진입 경계");
    expect(html).toContain("저장 전 승인 게이트");
    expect(html).toContain("관리자 허브");
    expect(html.indexOf("운영 검토 순서")).toBeLessThan(html.indexOf("오늘 먼저 볼 운영 체크포인트"));
    expect(html.indexOf("오늘 먼저 볼 운영 체크포인트")).toBeLessThan(html.indexOf("권한별 진입 경계"));
  });

  it("shows only the routes each admin viewer is allowed to open from the hub cards", () => {
    expect(getAdminPageCardsForRole("HR_ADMIN").map((card) => card.href)).toEqual(["/admin/users", "/admin/policies"]);
    expect(getAdminPageCardsForRole("AUDITOR").map((card) => card.href)).toEqual(["/admin/audit-logs"]);
    expect(getAdminPageCardsForRole("COMPANY_ADMIN").map((card) => card.href)).toEqual([
      "/admin/users",
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

    const previewResponse = await app.request(appRoutes.admin.users, {
      headers: {
        cookie,
      },
    });
    expect(previewResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await previewResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");
    const preview = buildAdminUsersPreviewFixture();
    const html = renderToStaticMarkup(
      <AdminUsersPageContent
        preview={preview}
        actionMessage="권한 diff preview 완료: 관리자 테스트 → HR_ADMIN (실저장 없음)"
        actionType="role"
        focusMessage="권한 diff preview 뒤 /management, /admin/users, /admin/audit-logs 접근 결과를 다시 눌러봅니다."
      />,
    );

    expect(html).toContain("현재 검토 중인 사용자");
    expect(html).toContain("Phase 55 관리자 계정·권한·조직 실사용화");
    expect(html).toContain("Phase 55 관리자 온보딩·운영 순서");
    expect(html).toContain("역할별 시작 레인과 차단 기준");
    expect(html).toContain("HR_ADMIN");
    expect(html).toContain("MANAGER");
    expect(html).toContain("COMPANY_ADMIN");
    expect(html).toContain("운영자 설정 read model");
    expect(html).toContain("정책 시작점");
    expect(html).toContain("회사 공통 고정 바로가기 source");
    expect(html).toContain("권한 기반 사용자 전용 바로가기 source");
    expect(html).toContain("일반 조회와 운영 검토 책임 분리");
    expect(html).toContain("사용자 생성 dev-safe 흐름");
    expect(html).toContain("역할 / 업무권한 지정");
    expect(html).toContain("활성 / 비활성 전환");
    expect(html).toContain("비밀번호 초기화 / 변경");
    expect(html).toContain("방금 실행한 preview 다음 확인");
    expect(html).toContain("권한 diff preview 뒤 /management, /admin/users, /admin/audit-logs 접근 결과를 다시 눌러봅니다.");
    expect(html).toContain("/home 공통 landing 뒤 HR은 /admin/users, 운영은 /management, 감사는 /admin/audit-logs 로 이어지는지 재확인");
    expect(html).toContain("/work-items/branch → /employees → /org → /management");
    expect(html).toContain("/employees · /org 는 read-only 확인용이며 /admin/users · /admin/policies preview 는 기본 진입 차단");
    expect(html).toContain("forbidden / empty / error / offline / loading / dev-safe 경계");
    expect(html).toContain("실저장 없음");
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

    const previewResponse = await app.request(appRoutes.admin.users, {
      headers: {
        cookie,
      },
    });
    expect(previewResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await previewResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");
    const preview = buildAdminUsersPreviewFixture();
    const html = renderToStaticMarkup(
      <AdminUsersPageContent
        preview={preview}
        loadErrorKind="offline"
        loadError="계정관리 preview 재조회가 중단되었습니다: network timeout"
      />,
    );

    expect(classifyAdminUsersLoadErrorKind("network timeout while fetching admin users")).toBe("offline");
    expect(classifyAdminUsersLoadErrorKind("네트워크 연결이 끊겼습니다")).toBe("offline");
    expect(classifyAdminUsersLoadErrorKind("응답 형식을 해석하지 못했습니다")).toBe("error");
    expect(html).toContain("offline 상태: 네트워크가 불안정해 계정관리 미리보기를 다시 불러와야 합니다");
    expect(html).toContain("관리자 PWA 는 읽기 중심 확인만 일부 도와주며");
    expect(html).toContain("네트워크 연결을 다시 확인하고 `/admin` 에서 새로고침");
    expect(html).toContain("복구 경로: /admin · /admin/users · /admin/policies · /admin/audit-logs · /offline");
  });

  it("separates offline retry guidance from generic preview errors on the admin users page", async () => {
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

    const previewResponse = await app.request(appRoutes.admin.users, {
      headers: {
        cookie,
      },
    });
    expect(previewResponse.status).toBe(503);
    expect(errorResponseSchema.parse(await previewResponse.json()).error.code).toBe("DB_NOT_CONFIGURED");
    const preview = buildAdminUsersPreviewFixture();
    const html = renderToStaticMarkup(
      <AdminUsersPageContent
        preview={preview}
        loadErrorKind="offline"
        loadError="네트워크 연결이 끊겨 계정관리 preview 를 다시 불러오지 못했습니다."
      />,
    );

    expect(html).toContain("offline 상태: 네트워크가 불안정해 계정관리 미리보기를 다시 불러와야 합니다");
    expect(html).toContain("네트워크 연결이 끊겨 계정관리 preview 를 다시 불러오지 못했습니다.");
    expect(html).toContain("네트워크가 불안정하거나 연결이 끊겨 preview 를 다시 시도해야 하는 상태입니다.");
  });

  it("keeps policy review cards in a consistent current-candidate-capability format", () => {
    const html = renderToStaticMarkup(<AdminPoliciesPage />);

    expect(html).toContain("협업 화면과 운영 정책 화면의 경계");
    expect(html).toContain("/boards · /documents");
    expect(html).toContain("현재 운영 기준");
    expect(html).toContain("candidate 변경안");
    expect(html).toContain("필요 capability");
    expect(html).toContain("감사 preview");
    expect(html).toContain("문서 / 첨부 정책");
    expect(html).toContain("근태 / 출퇴근 등록 방식 정책");
    expect(html).toContain("현재 허용 방식");
    expect(html).toContain("candidate 허용 방식");
    expect(html).toContain("태그 단말 연동 예정 skeleton");
    expect(html).toContain("우선순위: 회사 기본 &lt; 근무지/지점 &lt; 부서/팀 &lt; 직무/역할");
    expect(html).toContain("예상 적용 인원 2명");
    expect(html).toContain("샘플 직원 미리보기");
    expect(html).toContain("동일 target 활성 정책 중복: 근무지/지점 · 원격 실험실");
  });

  it("shows employee attendance actions without exposing disallowed old mobile/PC labels", () => {
    const html = renderToStaticMarkup(<AttendancePage />);

    expect(html).toContain("오늘 근태");
    expect(html).toContain("허용 방식");
    expect(html).toContain("태그 · PC");
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
