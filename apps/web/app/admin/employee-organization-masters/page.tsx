import React from "react";

import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import { EmployeeOrganizationMastersClient } from "./employee-organization-masters-client";

export default function EmployeeOrganizationMastersPage() {
  return (
    <PageShell
      backHref="/admin"
      backLabel="관리자 허브로"
      eyebrow="관리자 기능"
      title="사원 조직정보 기준설정"
      description="사원 생성/상세패널에서 사용하는 지사, 부서, 직급, 직위, 직책, 사용자그룹, 부서별 담당업무를 운영 DB 기준정보로 관리합니다."
      actions={<Pill tone="accent">operational-db</Pill>}
    >
      <SurfaceSection
        title="기준정보 등록/수정/삭제"
        description="삭제는 연결 이력 보존을 위해 사용중지로 처리하고, 모든 변경은 감사로그 후보로 남깁니다."
      >
        <EmployeeOrganizationMastersClient />
      </SurfaceSection>
    </PageShell>
  );
}
