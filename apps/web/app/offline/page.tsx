import React from "react";
import { headers } from "next/headers";

import { getTrustedHostFromHeaders } from "../../admin-host";
import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import { getAppShellConfigForHost, getOfflineGuidanceForHost, getRecoveryRouteCardsForHost, offlineTaskGuides } from "../mobile-pwa-config";

async function getRequestHost() {
  const requestHeaders = await headers();
  return getTrustedHostFromHeaders(requestHeaders);
}

export default async function OfflinePage() {
  const host = await getRequestHost();
  const shellConfig = getAppShellConfigForHost(host);
  const offlineGuidance = getOfflineGuidanceForHost(host);
  const recoveryRouteCards = getRecoveryRouteCardsForHost(host);
  const isAdminContext = shellConfig.homeHref === "/admin";
  const visibleTaskGuides = offlineTaskGuides.filter((item) => (isAdminContext ? true : !item.adminOnly));

  return (
    <PageShell
      backHref={shellConfig.homeHref}
      backLabel={isAdminContext ? "관리자 홈으로" : "홈으로"}
      eyebrow={isAdminContext ? "admin offline 안내" : "offline 안내 skeleton"}
      title={isAdminContext ? "관리자 오프라인 / 네트워크 불안정 안내" : "오프라인 / 네트워크 불안정 안내"}
      description={
        isAdminContext
          ? "관리자 PWA 는 설치 가능하더라도 사용자/권한/정책/감사 로그 변경을 오프라인 성공처럼 포장하지 않습니다."
          : "완전한 offline sync 대신, 지금 가능한 일과 불가능한 일을 명확히 설명하는 PWA skeleton 안내입니다."
      }
      actions={<Pill tone="warning">{isAdminContext ? "admin changes stay online-only" : "no fake success UX"}</Pill>}
    >
      <SurfaceSection
        title="지금 가능한 기능"
        description={isAdminContext ? "관리자 host 에서는 읽기 중심 확인과 제약 안내만 남깁니다." : "읽기 중심 흐름만 제한적으로 안내합니다."}
      >
        <ul className="summary-list">
          {offlineGuidance.availableNow.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection
        title="지금 막아야 하는 기능"
        description={
          isAdminContext
            ? "관리자 상태 변경은 오프라인에서 성공처럼 보이게 만들지 않고, 최신성 검증이 필요한 판단도 막습니다."
            : "상태 변경이 필요한 작업은 offline 에서 성공처럼 보이게 만들지 않습니다."
        }
        muted
      >
        <ul className="summary-list">
          {offlineGuidance.blockedNow.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="다시 시도 절차" description="안심시키는 문구보다 현재 제약과 재시도 절차를 우선합니다.">
        <ol className="number-list">
          {offlineGuidance.retrySteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </SurfaceSection>

      <SurfaceSection title="업무별 오프라인 판정" description="현장에서 자주 쓰는 route 별로 지금 읽을 수 있는 것과 막아야 하는 것을 같은 형식으로 봅니다.">
        <div className="grid-auto-compact">
          {visibleTaskGuides.map((item) => (
            <article key={item.href} className="info-card">
              <Pill tone={item.adminOnly ? "warning" : "accent"}>{item.label}</Pill>
              <h3>{item.href}</h3>
              <p>{item.available}</p>
              <p className="card-note">막힘: {item.blocked}</p>
              <p className="card-note">재시도: {item.retryHint}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      {isAdminContext ? (
        <SurfaceSection
          title="설치 후 바로 확인할 관리자 화면"
          description="관리자 설치는 일반 사용자 앱 대체가 아니라 운영 허브 접근성을 높이기 위한 것입니다."
        >
          <ul className="summary-list">
            {shellConfig.navItems.map((item) => (
              <li key={item.href}>
                <strong>{item.label}</strong>
                <div>{item.href}</div>
                <div>{item.summary}</div>
              </li>
            ))}
          </ul>
        </SurfaceSection>
      ) : null}

      <SurfaceSection title="설치 안내와 연결되는 원칙" description="설치가 가능하더라도 같은 origin 과 현재 제약을 그대로 유지합니다.">
        <ul className="summary-list">
          {shellConfig.installGuideSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection
        title="복구 route 모음"
        description={
          isAdminContext
            ? "관리자 host 에서는 관리자 허브·사용자/권한·운영 정책·감사 로그·오프라인 안내 안에서만 다시 맥락을 복구합니다."
            : "화면이 막히면 홈·메뉴·알림·오프라인 4개 route 안에서 다시 맥락을 복구합니다."
        }
      >
        <div className="grid-auto-compact">
          {recoveryRouteCards.map((item) => (
            <article key={item.href} className="route-card">
              <h3>{item.label}</h3>
              <p>{item.summary}</p>
              <a href={item.href}>{item.href}</a>
            </article>
          ))}
        </div>
      </SurfaceSection>
    </PageShell>
  );
}
