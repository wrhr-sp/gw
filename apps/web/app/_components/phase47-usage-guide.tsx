import React from "react";
import { isAdminCapableRoleCode, isLegalManagementRoleCode, type RoleCode } from "@gw/shared";

import { SurfaceSection } from "./page-shell";

type StatusGuideCard = {
  title: string;
  summary: string;
  detail: string;
};

type RecommendedFlow = {
  title: string;
  detail: string;
  routes: readonly string[];
};

function getPhase47RecommendedFlows(roleCode?: RoleCode | null): readonly RecommendedFlow[] {
  const flows: RecommendedFlow[] = [
    {
      title: "일반 직원 · 팀장 확인 순서",
      detail: "파일럿/UAT 기준으로도 같은 정보구조를 따라 홈 → 근태 → 휴가 → 결재 → 협업 → 내 정보 순서로 확인합니다.",
      routes: ["/login", "/home", "/attendance", "/leave", "/approvals", "/boards", "/documents", "/me"],
    },
  ];

  if (roleCode && isAdminCapableRoleCode(roleCode)) {
    flows.push({
      title: "관리자 계정·정책 확인 순서",
      detail: "일반 홈과 운영 레인을 섞지 않고, 운영 허브 확인 뒤 계정·정책·감사 레인을 같은 문장으로 이어 봅니다.",
      routes: ["/login", "/home", "/management", "/admin/users", "/admin/policies", "/admin/audit-logs", "/api/health"],
    });
  }

  if (roleCode && isLegalManagementRoleCode(roleCode)) {
    flows.push({
      title: roleCode === "MANAGER" ? "지점 관리자 확인 순서" : "운영 관리자 확인 순서",
      detail:
        roleCode === "MANAGER"
          ? "공통 랜딩 뒤 지점 범위 레인과 회사 범위 문맥을 구분해 확인하고, 읽기 조회와 운영 검토를 같은 책임처럼 섞지 않습니다."
          : "일반 홈과 운영 허브를 섞지 않고, 계정관리/정책 검토와 민감 내부관리 화면을 별도 허브에서 이어 봅니다.",
      routes:
        roleCode === "MANAGER"
          ? ["/login", "/home", "/work-items/branch", "/employees", "/org", "/management"]
          : ["/login", "/home", "/management", "/admin/users", "/admin/policies", "/payroll", "/work-items/tax", "/work-items/labor", "/work-items/legal", "/admin/audit-logs", "/api/health"],
    });
  }

  if (roleCode === "AUDITOR") {
    flows.push({
      title: "감사 확인 순서",
      detail: "감사 역할은 감사 추적 레인과 최소 liveness 기준만 읽고, 사용자/정책 관리 레인과 섞지 않습니다.",
      routes: ["/login", "/admin/audit-logs", "/api/health"],
    });
  }

  return flows;
}

export const phase47StatusGuideCards: readonly StatusGuideCard[] = [
  {
    title: "loading",
    summary: "아직 읽어 오는 중인 상태입니다.",
    detail: "저장 성공이나 권한 부족으로 단정하지 말고 잠시 기다린 뒤 `/home` 또는 `/menu` 에서 다시 확인합니다.",
  },
  {
    title: "empty",
    summary: "정상적으로 비어 있을 수 있는 상태입니다.",
    detail: "오늘 처리할 항목이 없거나 권한 범위에 해당 데이터가 없을 수 있으므로, 다음 행동은 route 맥락에서 고릅니다.",
  },
  {
    title: "error",
    summary: "조회 응답이나 불러오기에 실패한 상태입니다.",
    detail: "같은 화면에서 반복 저장을 시도하지 말고 `/home` · `/menu` · `/offline` 순서로 복구 경로를 다시 탑니다.",
  },
  {
    title: "forbidden",
    summary: "권한 또는 접근 범위가 맞지 않는 상태입니다.",
    detail: "숨겨진 운영 메뉴를 대신 열어 주지 않고, 필요한 경우 지정 담당자 레인(`/management`, `/admin*`)에서만 확인합니다.",
  },
  {
    title: "offline",
    summary: "네트워크가 불안정해 재시도가 필요한 상태입니다.",
    detail: "오프라인에서는 상태 변경 성공처럼 보이지 않게 막고, 가능한 일/막히는 일/재시도 절차를 먼저 안내합니다.",
  },
  {
    title: "내부 검증",
    summary: "실운영 저장 전 검토용 상태입니다.",
    detail: "내부 검증용 계정과 검증 데이터는 실운영 기본 계정이나 실제 외부 연동 완료로 설명하지 않습니다.",
  },
] as const;

export function Phase47StatusGuideSection({
  title = "상태 안내 기준선",
  description = "loading, empty, error, forbidden, offline, 내부 검증을 같은 장애처럼 읽지 않도록 이번 Phase 기준 문장을 한 번에 고정합니다.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <SurfaceSection title={title} description={description}>
      <div className="grid-auto-compact">
        {phase47StatusGuideCards.map((card) => (
          <article key={card.title} className="info-card">
            <h3>{card.title}</h3>
            <p>{card.summary}</p>
            <p className="card-note">{card.detail}</p>
          </article>
        ))}
      </div>
    </SurfaceSection>
  );
}

export function Phase47RecommendedFlowSection({
  title = "Phase 47 추천 확인 순서",
  description = "live URL 에서 직접 눌러 볼 때도 홈/복구/운영 레인을 같은 순서로 따라가게 고정합니다.",
  roleCode = null,
}: {
  title?: string;
  description?: string;
  roleCode?: RoleCode | null;
}) {
  const flows = getPhase47RecommendedFlows(roleCode);

  return (
    <SurfaceSection title={title} description={description}>
      <div className="grid-auto-compact">
        {flows.map((flow) => (
          <article key={flow.title} className="info-card">
            <h3>{flow.title}</h3>
            <p>{flow.detail}</p>
            <p className="card-note">{flow.routes.join(" → ")}</p>
          </article>
        ))}
      </div>
    </SurfaceSection>
  );
}
