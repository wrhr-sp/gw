import React from "react";
import Link from "next/link";

import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import { adminUserHighlights, adminUserQueues, adminUserReviewFields, companySettingsGroups } from "../../../admin-skeleton-config";

const roleDiffPreview = [
  "현재 역할: EMPLOYEE → 후보 역할: HR_ADMIN + AUDITOR",
  "역할 후보 검토는 실제 부여 전에 owner 와 승인 사유를 함께 확인합니다.",
  "고위험 권한: invite.manage / audit.read 노출 위치 재확인",
  "변경 사유 없으면 저장 대신 review 보류 유지",
] as const;

const statusChangePreview = [
  "상태 변경 diff 는 현재 상태와 다음 상태를 한 번에 비교해 보여 줍니다.",
  "active → on_leave 후보는 결재/휴가/조직 조회 영향만 preview 로 표시",
  "inactive 전환 후보는 소유 문서/게시글/승인 위임 영향 범위를 먼저 요약",
  "실제 저장 없이 다음 상태와 reasonRequired 표시만 유지",
] as const;

export default function AdminUsersPage() {
  return (
    <PageShell
      backHref="/admin"
      backLabel="관리자 허브로"
      eyebrow="Phase 23 관리자 운영 콘솔 실사용 1차"
      title="관리자 / 사용자"
      description="사용자 저장보다 먼저 연결 상태, 권한 diff, 상태 변경 preview 를 검토하는 화면입니다. 저장 단계로 넘기기 전에 audit-ready 정보를 먼저 정리합니다."
      actions={<Pill tone="warning">review before save</Pill>}
    >
      <SurfaceSection
        title="일반 직원 조회와 운영 검토의 경계"
        description="`/employees` 는 읽기 중심 일반 조회이고, 이 화면은 저장 전 운영 변경 후보 검토용입니다."
      >
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill tone="accent">/employees</Pill>
            <h3>일반 조회</h3>
            <p>직원 이름, 소속, 상태를 읽고 조직 확인 흐름으로 이어집니다.</p>
          </article>
          <article className="info-card">
            <Pill tone="warning">/admin/users</Pill>
            <h3>운영 변경 후보 검토</h3>
            <p>초대, 비활성화, 역할 diff, 고위험 권한을 저장 전 preview 로만 검토합니다.</p>
          </article>
        </div>
      </SurfaceSection>

      <SurfaceSection
        title="오늘 확인할 사용자 큐"
        description="운영자가 가장 먼저 열어야 할 사용자 검토 항목을 역할별 owner 와 함께 정리합니다."
      >
        <div className="grid-auto-compact">
          {adminUserQueues.map((item) => (
            <article key={item.title} className="info-card">
              <Pill>{item.owner}</Pill>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <p className="card-note">다음 액션: {item.nextAction}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection
        title="회사 기본 설정과 사용자 연결"
        description="관리자 사용자 검토도 회사 기본 설정 모델의 어떤 묶음에 속하는지 먼저 보여 줍니다."
      >
        <div className="grid-auto-compact">
          {companySettingsGroups
            .filter((group) => group.id === "organization_people_access" || group.id === "admin_operations")
            .map((group) => (
              <article key={group.id} className="info-card">
                <Pill>{group.owner}</Pill>
                <h3>{group.title}</h3>
                <p>{group.summary}</p>
                <p className="card-note">연결 화면: {group.linkedRoutes.join(" · ")}</p>
              </article>
            ))}
        </div>
      </SurfaceSection>

      <SurfaceSection
        title="권한 diff 미리보기"
        description="현재 역할과 후보 역할의 before/after 차이를 먼저 보여 주고 고위험 권한은 별도 메모로 고정합니다."
      >
        <ul className="summary-list">
          {roleDiffPreview.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection
        title="상태 변경 preview"
        description="활성/휴직/비활성 전환 후보를 실제 저장 없이 영향 범위와 사유 기준으로 먼저 설명합니다."
      >
        <ul className="summary-list">
          {statusChangePreview.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection
        title="감사 이벤트 preview"
        description="누가 어떤 변경 후보를 열어봤는지와 변경 사유가 있는지를 함께 기록하는 기준입니다."
      >
        <p className="card-note">감사 후보는 사용자 검토, 역할 후보, 상태 변경 diff 를 열람한 시점부터 같은 회사 경계 안에서 남깁니다.</p>
        <div className="grid-auto-compact">
          {adminUserReviewFields.map((item) => (
            <article key={item} className="route-card">
              <h3>{item}</h3>
              <p>{item === "감사 이벤트 preview" ? "audit candidate 생성 여부와 company boundary 를 함께 확인합니다." : "저장 없이 review 단계에서 먼저 검토하는 항목입니다."}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="가드레일" description="운영 변경처럼 보이더라도 이번 단계는 검토 흐름 고정까지만 허용합니다." muted>
        <ul className="bullet-list">
          {adminUserHighlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
          <li>
            일반 업무 화면으로 돌아가려면 <Link href="/dashboard">대시보드</Link> 에서 다시 시작합니다.
          </li>
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
