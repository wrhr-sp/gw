import React from "react";

import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import { OrganizationInfoClient } from "./organization-info-client";

export default function OrganizationInfoPage() {
  return (
    <PageShell
      backHref="/admin"
      backLabel="관리자 허브로"
      title="조직정보"
      description="지사, 부서, 직급, 직위, 직책, 담당, 사용자그룹을 관리하고 코드정보 정책으로 코드 자동생성 기준을 설정합니다."
      actions={<Pill tone="accent">조직정보</Pill>}
    >
      <SurfaceSection
        title="조직정보 / 코드정보"
        description="조직정보는 실제 선택값, 코드정보는 자동 코드 생성 정책입니다. 사용자그룹은 직원들을 특정 기준으로 묶어 시스템 권한·알림·결재·조회 범위를 적용하는 그룹입니다."
      >
        <OrganizationInfoClient />
      </SurfaceSection>
    </PageShell>
  );
}
