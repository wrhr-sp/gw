import React from "react";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";

export default function MailPage() {
  return (
    <PageShell
      backHref="/menu"
      backLabel="전체 메뉴로"
      eyebrow="Phase 24 협업 placeholder"
      title="메일 placeholder"
      titleHref="/mail"
      description="기업 메일 서버, 실제 발송, 초대 메일 연동 전 단계에서 파일럿 사용자가 기대해야 할 범위를 먼저 정리하는 안내 화면입니다."
      actions={
        <div className="pill-row">
          <Pill tone="warning">실제 메일 서버 미연결</Pill>
          <Pill>승인 게이트 유지</Pill>
        </div>
      }
    >
      <SurfaceSection title="이번 파일럿에서 보여 주는 것" description="메일 기능을 과장하지 않는 최소 범위만 유지합니다.">
        <ul className="summary-list">
          <li>모바일/PC 탐색 구조 안에서 `메일` 메뉴 위치와 설명 문구를 고정합니다.</li>
          <li>실제 메일 송수신, 외부 초대 메일, 첨부 다운로드 확대는 아직 연결하지 않습니다.</li>
          <li>사용자는 메일 기능이 준비 중이라는 사실과 다음에 확인할 승인 게이트를 쉽게 이해해야 합니다.</li>
        </ul>
      </SurfaceSection>

      <SurfaceSection title="승인 전까지 막아 두는 항목" description="이번 카드 범위를 넘는 실제 운영 작업입니다." muted>
        <ul className="summary-list">
          <li>실제 메일 서버 연결</li>
          <li>초대/비밀번호/외부 알림 메일 발송</li>
          <li>실데이터 첨부 업로드와 외부 다운로드 공개</li>
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
