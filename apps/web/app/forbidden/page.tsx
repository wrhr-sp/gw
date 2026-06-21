import React from "react";
import Link from "next/link";

import { PageShell, SurfaceSection } from "../_components/page-shell";

export default function ForbiddenPage() {
  return (
    <PageShell
      backHref="/home"
      backLabel="대시보드로"
      title="접근 권한이 없습니다"
      description="이 preview 에서는 로그인 여부만이 아니라 역할 경계도 함께 확인합니다. 일반 사용자와 감사 전용 사용자는 허용된 운영 경로만 열리고, 나머지 관리자 화면은 이 안내 페이지로 막습니다."
    >
      <SurfaceSection title="안내">
        <ul className="summary-list">
          <li>일반 업무는 대시보드, 조직도, 직원, 근태, 휴가 화면에서 계속 진행합니다.</li>
          <li>감사 권한 사용자는 허용된 경우 <a href="/admin/audit-logs">/admin/audit-logs</a> 로 이동해 주세요.</li>
          <li>운영 권한이 필요한 변경은 관리자 권한 계정으로 다시 확인합니다.</li>
        </ul>
        <Link href="/home">대시보드로 돌아가기</Link>
      </SurfaceSection>
    </PageShell>
  );
}
