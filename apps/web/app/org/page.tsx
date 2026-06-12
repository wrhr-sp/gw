import React from "react";
import { appRoutes } from "@gw/shared";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";

const orgSections = [
  {
    title: "조직 구조",
    description: "상위/하위 부서 관계와 활성 상태를 먼저 읽기 전용으로 보여 줍니다.",
    href: appRoutes.org.departments,
    badge: "부서",
  },
  {
    title: "역할/직책 요약",
    description: "대표 역할 설명과 scope 차이만 먼저 보여 주고 운영 변경은 열지 않습니다.",
    href: appRoutes.org.roles,
    badge: "역할",
  },
  {
    title: "권한 체계 안내",
    description: "권한 코드를 직접 바꾸지 않고 카탈로그/안내 수준으로만 노출합니다.",
    href: appRoutes.org.permissions,
    badge: "권한",
  },
] as const;

const guardrails = [
  "이 화면은 조직을 이해하는 읽기 전용 흐름입니다.",
  "정책/권한 변경은 /admin/policies 또는 /admin/users 에서 따로 검토합니다.",
  "작은 화면에서는 긴 표보다 카드/섹션 순서가 먼저 읽히도록 유지합니다.",
] as const;

export default function OrgPage() {
  return (
    <PageShell
      backHref="/dashboard"
      backLabel="대시보드로"
      eyebrow="Phase 14 일반 조회 연결"
      title="조직 구조 / 역할 안내 skeleton"
      description="대시보드의 조직 구조 보기 흐름과 같은 언어로 부서 구조, 역할/직책, 권한 체계 안내를 읽기 전용으로 묶은 dev-safe placeholder 입니다."
      actions={
        <div className="pill-row">
          <Pill tone="accent">read-only structure</Pill>
          <Pill>mobile section flow</Pill>
        </div>
      }
    >
      <SurfaceSection title="가드레일" description="관리자 정책 화면과 섞이지 않도록 경계를 먼저 적어 둡니다.">
        <ul className="bullet-list">
          {guardrails.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="조직 탐색 블록" description="각 블록은 API와 읽기용 설명을 함께 연결합니다.">
        <div className="grid-auto">
          {orgSections.map((section) => (
            <article key={section.title} className="route-card">
              <div className="pill-row">
                <Pill>{section.badge}</Pill>
              </div>
              <h3>{section.title}</h3>
              <p>{section.description}</p>
              <a href={section.href}>{section.href}</a>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="관리자 경계 안내" description="일반 조회 화면의 기본 CTA 를 운영 변경 액션으로 채우지 않습니다." muted>
        <ul className="summary-list">
          <li>
            <a href="/admin/users">/admin/users</a> — 운영 사용자 연결, 역할 후보, 상태 변경 diff 검토
          </li>
          <li>
            <a href="/admin/policies">/admin/policies</a> — 정책/권한 변경 후보 검토
          </li>
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
