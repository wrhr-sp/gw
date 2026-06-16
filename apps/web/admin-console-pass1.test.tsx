import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { adminUsersListResponseSchema, appRoutes } from "@gw/shared";

import { AdminPageContent } from "./admin-page-content";
import { getAdminPageCardsForRole } from "./admin-page-access";
import { app } from "../api/src/app";
import { AdminUsersPageContent } from "./app/admin/users/admin-users-page-content";
import AdminPoliciesPage from "./app/admin/policies/page";
import AdminAuditLogsPage from "./app/admin/audit-logs/page";
import AttendancePage from "./app/attendance/page";

describe("Phase 13 admin console pass 1", () => {
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
    const preview = adminUsersListResponseSchema.parse(await previewResponse.json()).data;
    const html = renderToStaticMarkup(
      <AdminUsersPageContent
        preview={preview}
        actionMessage="권한 diff preview 완료: 관리자 테스트 → HR_ADMIN (실저장 없음)"
        actionType="role"
        focusMessage="권한 diff preview 뒤 /management, /admin/users, /admin/audit-logs 접근 결과를 다시 눌러봅니다."
      />,
    );

    expect(html).toContain("현재 검토 중인 사용자");
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
    expect(html).toContain("/management, /admin/users, /admin/audit-logs 노출/차단 기준 재확인");
    expect(html).toContain("forbidden / empty / error / dev-safe 경계");
    expect(html).toContain("실저장 없음");
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

  it("shows only the effective-policy-approved attendance methods on the employee attendance page", () => {
    const html = renderToStaticMarkup(<AttendancePage />);

    expect(html).toContain("현재 적용 정책: 부산 물류센터 &gt; 현장직 기준");
    expect(html).toContain("허용 방식: 태그");
    expect(html).toContain("모바일/PC 등록은 현재 소속 정책에서 허용되지 않습니다");
    expect(html).not.toContain("모바일 출근 등록");
    expect(html).not.toContain("PC 출근 등록");
    expect(html).toContain("태그 단말 연동은 별도 승인 후 연결합니다");
  });

  it("keeps audit logs focused on filters, timeline, detail context, and masking boundaries", () => {
    const html = renderToStaticMarkup(<AdminAuditLogsPage />);

    expect(html).toContain("감사 전용 진입 의미");
    expect(html).toContain("조회 필터");
    expect(html).toContain("최근 이벤트 타임라인");
    expect(html).toContain("상세 패널");
    expect(html).toContain("비노출/회사 경계");
    expect(html).not.toContain("storageKey");
    expect(html).not.toContain("signed URL");
    expect(html).not.toContain("bucket");
  });
});
