import React from "react";

import { PageShell, SurfaceSection } from "../_components/page-shell";

const branches = [
  { id: "gangnam", name: "강남지점", region: "서울", manager: "김지윤", access: "전체 운영관리" },
  { id: "seoul", name: "서울지점", region: "서울", manager: "정하린", access: "전체 운영관리" },
  { id: "busan", name: "부산지점", region: "부산", manager: "박민재", access: "운영이슈 확인" },
  { id: "daejeon", name: "대전지점", region: "대전", manager: "이서연", access: "매출보고 확인" },
  { id: "gwangju", name: "광주지점", region: "광주", manager: "최현우", access: "입금요청 확인" },
] as const;

export default function PlaceOfBusinessPage() {
  return (
    <PageShell title="지점관리포털 / Place of business" titlePlacement="content" titleHref={null}>
      <SurfaceSection title="지점관리포털 / Place of business" description="접근 가능한 지점을 선택하면 해당 지점관리 페이지가 새 흐름으로 열립니다.">
        <div className="feature-workspace__rows">
          {branches.map((branch) => (
            <article className="feature-workspace__row" key={branch.id}>
              <div>
                <strong>{branch.name}</strong>
                <span>{branch.region} · {branch.manager} · {branch.access}</span>
              </div>
              <a href={`/Place of business/${branch.id}`}>지점 보기</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="보고 기능" description="지점별 매출보고, 운영이슈, 입금요청을 지점 상세 화면에서 처리합니다." muted>
        <ul className="summary-list">
          <li>매출보고: 일 매출, 결제수단, 특이사항 작성</li>
          <li>운영이슈: 시설, 인력, 고객 응대 이슈 등록</li>
          <li>입금요청: 요청 금액, 예정일, 증빙 준비</li>
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
