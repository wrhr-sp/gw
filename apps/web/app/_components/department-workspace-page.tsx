import React from "react";

import { FeaturePageOverflowMenu } from "./feature-page-overflow-menu";
import { PageShell, Pill, SurfaceSection } from "./page-shell";

type DepartmentWorkspacePageProps = {
  koreanName: string;
  englishName: string;
  roleSummary: string;
};

const departmentIdByName: Record<string, string> = {
  대표이사실: "ceo",
  전략기획실: "strategy",
  경영지원팀: "support",
  영업관리팀: "sales-admin",
  광고사업팀: "ads",
  운영사업부: "operations",
};

const sharedWorkLinks = [
  { label: "게시판", href: "/boards", description: "부서 공지와 업무 공유 글을 확인합니다." },
  { label: "메일", href: "/mail", description: "부서 문맥을 유지한 상태로 메일 업무를 엽니다." },
  { label: "메신저", href: "/messenger", description: "부서 협업 대화를 이어갑니다." },
  { label: "결재", href: "/approvals", description: "부서 결재 문서와 승인 흐름을 확인합니다." },
  { label: "문서", href: "/documents", description: "부서 문서함과 첨부 자료를 확인합니다." },
  { label: "근태", href: "/attendance", description: "부서 구성원의 근태 흐름을 확인합니다." },
] as const;

const departmentWorkLinksById: Record<string, readonly { label: string; href: string; description: string }[]> = {
  ceo: [
    { label: "경영 현황", href: "/management", description: "전사 경영 지표와 주요 관리 업무로 이동합니다." },
    { label: "영업 현황", href: "/sales", description: "영업 실적과 운영 흐름을 확인합니다." },
    { label: "지점관리", href: "/Place of business", description: "지점관리포털 홈을 새 업무 흐름으로 확인합니다." },
    { label: "관리자 페이지", href: "/admin", description: "총괄관리계정 기준 관리자 기능으로 이동합니다." },
  ],
  strategy: [
    { label: "경영 현황", href: "/management", description: "전략 과제와 연결되는 경영 지표를 확인합니다." },
    { label: "영업 현황", href: "/sales", description: "전략 수립에 필요한 영업 흐름을 확인합니다." },
    { label: "세무 내부관리", href: "/work-items/tax", description: "세무 관련 내부 관리 항목을 확인합니다." },
    { label: "법무 내부관리", href: "/work-items/legal", description: "법무 검토와 계약 관련 내부 업무를 확인합니다." },
  ],
  support: [
    { label: "HR 내부관리", href: "/work-items/hr", description: "인사·조직 지원 업무를 확인합니다." },
    { label: "급여 내부관리", href: "/payroll", description: "급여 내부관리 업무로 이동합니다." },
    { label: "노무 내부관리", href: "/work-items/labor", description: "노무 관련 내부 업무를 확인합니다." },
    { label: "ERP/경리", href: "/management-support/erp/billings", description: "경리나라 연동 전 매출·청구·증빙·거래처 원장을 관리합니다." },
    { label: "관리자 페이지", href: "/admin", description: "관리자 기능과 정책 설정을 확인합니다." },
  ],
  "sales-admin": [
    { label: "영업 현황", href: "/sales", description: "영업관리팀 전용 실적·고객 업무를 확인합니다." },
    { label: "지점관리", href: "/Place of business", description: "지점 영업 운영 흐름을 확인합니다." },
    { label: "법무 내부관리", href: "/work-items/legal", description: "계약·법무 검토 흐름을 확인합니다." },
  ],
  ads: [
    { label: "영업 현황", href: "/sales", description: "광고 영업과 캠페인 관련 업무를 확인합니다." },
    { label: "경영 현황", href: "/management", description: "광고 사업 지표와 경영 흐름을 확인합니다." },
    { label: "법무 내부관리", href: "/work-items/legal", description: "광고 계약·법무 검토 업무를 확인합니다." },
  ],
  operations: [
    { label: "지점관리", href: "/Place of business", description: "운영사업부의 지점관리포털로 이동합니다." },
    { label: "지점 업무", href: "/work-items/branch", description: "지점 업무 처리와 보고 흐름을 확인합니다." },
    { label: "노무 내부관리", href: "/work-items/labor", description: "운영 조직의 노무 관련 업무를 확인합니다." },
  ],
};

function withDepartment(href: string, departmentId: string) {
  if (href === "/admin" || href === "/Place of business") {
    return href;
  }

  return `${href}${href.includes("?") ? "&" : "?"}department=${encodeURIComponent(departmentId)}`;
}

export function DepartmentWorkspacePage({ koreanName, englishName, roleSummary }: DepartmentWorkspacePageProps) {
  const departmentId = departmentIdByName[koreanName] ?? "operations";
  const departmentWorkLinks = departmentWorkLinksById[departmentId] ?? [];

  return (
    <PageShell
      title={`${koreanName} / ${englishName}`}
      titlePlacement="content"
      titleHref={null}
      description={`${koreanName} 업무포털입니다. 기본업무로 이동해도 ${koreanName} 문맥을 유지합니다.`}
    >
      <div className="feature-workspace" aria-label={`${koreanName} 업무포털 진입 화면`}>
        <aside className="feature-workspace__nav" aria-label={`${koreanName} 업무포털 요약`}>
          <div className="feature-workspace__nav-header">
            <div>
              <h1>{koreanName} / {englishName}</h1>
              <p><strong>{koreanName} 업무포털</strong> · {roleSummary}</p>
            </div>
            <FeaturePageOverflowMenu label={`${koreanName} 업무포털`} />
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-labelledby="department-portal-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="department-portal-heading">{koreanName}에서 사용할 업무</h2>
              <p>아래 항목은 실제 기능 페이지로 이동합니다. 기본업무도 부서 문맥을 유지한 URL로 엽니다.</p>
            </div>
            <p className="feature-workspace__permission-hint">부서별 접근 권한은 기존 route guard와 권한 정책을 따릅니다.</p>
          </div>

          <SurfaceSection title="기본업무">
            <div className="feature-workspace__row-list">
              {sharedWorkLinks.map((item) => (
                <article className="feature-workspace__row" key={item.href}>
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.description}</p>
                  </div>
                  <a className="feature-workspace__row-action" href={withDepartment(item.href, departmentId)}>
                    {item.label} 열기
                  </a>
                </article>
              ))}
            </div>
          </SurfaceSection>

          <SurfaceSection title={`${koreanName} 부서업무`}>
            <div className="feature-workspace__row-list">
              {departmentWorkLinks.map((item) => (
                <article className="feature-workspace__row" key={item.href}>
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.description}</p>
                  </div>
                  <a className="feature-workspace__row-action" href={withDepartment(item.href, departmentId)}>
                    {item.label} 열기
                  </a>
                </article>
              ))}
            </div>
          </SurfaceSection>

          <div className="feature-workspace__notes" aria-label="부서업무포털 안내">
            <Pill tone="accent">새 탭 진입 후 현재 부서명 유지</Pill>
            <p>상단 부서업무포털 팝업에서 들어온 뒤 기본업무를 눌러도 로고 옆 문구가 {koreanName}으로 유지되도록 구성했습니다.</p>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
