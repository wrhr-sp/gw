import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import { installGuideSteps, offlineGuidance } from "../mobile-pwa-config";

export default function OfflinePage() {
  return (
    <PageShell
      backHref="/"
      backLabel="홈으로"
      eyebrow="offline 안내 skeleton"
      title="오프라인 / 네트워크 불안정 안내"
      description="완전한 offline sync 대신, 지금 가능한 일과 불가능한 일을 명확히 설명하는 PWA skeleton 안내입니다."
      actions={<Pill tone="warning">no fake success UX</Pill>}
    >
      <SurfaceSection title="지금 가능한 기능" description="읽기 중심 흐름만 제한적으로 안내합니다.">
        <ul className="summary-list">
          {offlineGuidance.availableNow.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="지금 막아야 하는 기능" description="상태 변경이 필요한 작업은 offline 에서 성공처럼 보이게 만들지 않습니다." muted>
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

      <SurfaceSection title="설치 안내와 연결되는 원칙" description="설치가 가능하더라도 같은 origin 과 현재 제약을 그대로 유지합니다.">
        <ul className="summary-list">
          {installGuideSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
