import React from "react";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";

const statusCards = [
  {
    title: "현재 열어 둔 것",
    body: "모바일 하단 탭과 PC 사이드바에서 같은 `메신저` 메뉴를 확인하고 placeholder honesty 를 유지합니다.",
  },
  {
    title: "아직 열지 않은 것",
    body: "실시간 채팅 서버, 읽음 동기화, 외부 메신저 브리지, 파일 전송은 이번 파일럿 범위에 포함하지 않습니다.",
  },
  {
    title: "파일럿에서 확인할 것",
    body: "사용자가 메신저가 아직 준비 중인 기능임을 오해 없이 이해하는지, 다른 핵심 업무 흐름으로 자연스럽게 돌아갈 수 있는지 봅니다.",
  },
] as const;

export default function MessengerPage() {
  return (
    <PageShell
      backHref="/menu"
      backLabel="전체 메뉴로"
      eyebrow="Phase 24 협업 placeholder"
      title="메신저 placeholder"
      titleHref="/messenger"
      description="실시간 메신저 외부 연동 전 단계에서 탭/메뉴 위치와 안내 문구를 먼저 고정한 파일럿 placeholder 화면입니다."
      actions={
        <div className="pill-row">
          <Pill tone="warning">실시간 연동 없음</Pill>
          <Pill>pilot honesty</Pill>
        </div>
      }
    >
      <SurfaceSection title="왜 지금 이 화면이 필요한가" description="탭만 만들어 두고 실제 기능처럼 보이지 않게 경계를 먼저 설명합니다.">
        <ul className="summary-list">
          <li>하단 탭 `메신저`가 실제 업무 제품 기대와 어떻게 연결되는지 위치를 먼저 고정합니다.</li>
          <li>아직 연결되지 않은 기능은 명확히 막고, 파일럿 참여자가 다른 업무 흐름으로 바로 복귀할 수 있게 둡니다.</li>
          <li>실제 실시간 채팅, 외부 메신저 연동, 푸시 알림은 별도 승인 게이트로 남깁니다.</li>
        </ul>
      </SurfaceSection>

      <SurfaceSection title="현재 상태" description="지금 되는 것과 아직 안 되는 것을 분리합니다.">
        <div className="grid-auto-compact">
          {statusCards.map((card) => (
            <article key={card.title} className="info-card">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>
    </PageShell>
  );
}
