import React from "react";
import { headers } from "next/headers";

import { getTrustedHostFromHeaders } from "../../admin-host";
import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import { adminOfflineGuidance, offlineGuidance, offlineTaskGuides } from "../mobile-pwa-config";

async function getRequestHost() {
  const requestHeaders = await headers();
  return getTrustedHostFromHeaders(requestHeaders);
}

export default async function OfflinePage() {
  const host = await getRequestHost();
  const isAdminContext = host?.startsWith("admin.") || host?.includes("gw-admin.") || false;
  const guidance = isAdminContext ? adminOfflineGuidance : offlineGuidance;

  const retrySteps = [
    "네트워크 연결 상태를 다시 확인합니다.",
    "연결이 돌아오면 로그인 화면으로 돌아가 다시 로그인합니다.",
    "문제가 계속되면 안정적인 PC 또는 사내 네트워크에서 다시 시도합니다.",
  ] as const;

  const limits = isAdminContext
    ? [
        "오프라인 상태에서는 사용자·권한·정책·감사 업무를 진행하지 않습니다.",
        "관리자 host 도 내부 허브 복구 링크를 열지 않고 로그인 재시도만 안내합니다.",
      ]
    : [
        "오프라인 상태에서는 대시보드, 메뉴, 근태, 결재, 문서 같은 내부 업무를 열지 않습니다.",
        "이 페이지는 업무 복구 입구가 아니라 로그인 재시도 안내만 제공합니다.",
      ];

  return (
    <PageShell
      backHref="/login"
      backLabel="로그인으로"
      eyebrow={isAdminContext ? "admin offline 안내" : "offline 안내"}
      title={isAdminContext ? "관리자 네트워크 재연결 안내" : "네트워크 재연결 안내"}
      description="연결이 불안정할 때도 내부 업무 링크를 열어 두지 않습니다. 연결이 돌아오면 로그인 화면으로 다시 시작해 주세요."
      actions={<Pill tone="warning">로그인 재시도만 안내</Pill>}
    >
      <SurfaceSection title="지금 가능한 일" description="오프라인 상태에서도 성공처럼 보이지 않는 범위만 남깁니다.">
        <ul className="summary-list">
          {guidance.availableNow.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="지금 해야 할 일" description="오프라인 업무 성공처럼 보이게 하지 않고, 다시 로그인하는 최소 절차만 남깁니다.">
        <ol className="number-list">
          {retrySteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </SurfaceSection>

      <SurfaceSection title="이 페이지에서 하지 않는 일" description="업무 복구 링크 모음이나 내부 우회 진입을 제공하지 않습니다." muted>
        <ul className="summary-list">
          {[...limits, ...guidance.blockedNow].map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="업무별 오프라인 경계" description="대표 업무에서 가능한 일과 막히는 일을 route 기준으로 짧게 다시 확인합니다.">
        <div className="grid-auto-compact">
          {offlineTaskGuides
            .filter((item) => (isAdminContext ? item.adminOnly : !item.adminOnly))
            .map((item) => (
              <article key={item.href} className="info-card">
                <h3>{item.label}</h3>
                <p>{item.available}</p>
                <p className="card-note">막히는 일: {item.blocked}</p>
                <p className="card-note">다시 시도: {item.retryHint}</p>
              </article>
            ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="다시 시작 경로" description="연결이 복구되면 아래 경로만 사용합니다.">
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill tone="accent">로그인</Pill>
            <h3>/login</h3>
            <p>아이디/비밀번호 로그인 화면으로 다시 시작합니다.</p>
            <a href="/login">/login</a>
          </article>
        </div>
      </SurfaceSection>
    </PageShell>
  );
}
