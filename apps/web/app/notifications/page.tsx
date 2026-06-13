import React from "react";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";

const checkpoints = [
  "알림 탭이 실제 푸시/문자 발송이 아니라 파일럿 공지용 placeholder 임을 명확히 보여 준다.",
  "오프라인/권한 부족/승인 대기 상태를 실제 성공 알림처럼 혼동하지 않게 구분한다.",
  "향후 외부 알림 연동이 붙더라도 지금은 same-origin 화면 안내까지만 포함한다.",
] as const;

export default function NotificationsPage() {
  return (
    <PageShell
      backHref="/menu"
      backLabel="전체 메뉴로"
      eyebrow="Phase 24 알림 placeholder"
      title="알림 placeholder"
      description="푸시, 메일, 메신저 브로드캐스트 전 단계에서 파일럿 참여자가 확인할 수 있는 알림 설명과 재확인 포인트만 남긴 화면입니다."
      actions={
        <div className="pill-row">
          <Pill tone="accent">placeholder only</Pill>
          <Pill tone="warning">외부 발송 없음</Pill>
        </div>
      }
    >
      <SurfaceSection title="파일럿 체크포인트" description="알림 탭은 실제 발송보다 기대치 관리가 더 중요합니다.">
        <ul className="summary-list">
          {checkpoints.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="다음 행동" description="알림 탭에서 업무가 끝나는 것이 아니라 다른 핵심 route 로 이동해야 합니다.">
        <div className="grid-auto-compact">
          <article className="route-card">
            <h3>홈으로 돌아가기</h3>
            <p>오늘 해야 할 업무 요약은 `/dashboard` 에서 다시 확인합니다.</p>
            <a href="/dashboard">/dashboard</a>
          </article>
          <article className="route-card">
            <h3>전체 메뉴 확인</h3>
            <p>근태, 휴가, 결재, 문서, 내 정보는 `/menu` 에서 같은 IA 로 다시 선택합니다.</p>
            <a href="/menu">/menu</a>
          </article>
        </div>
      </SurfaceSection>
    </PageShell>
  );
}
