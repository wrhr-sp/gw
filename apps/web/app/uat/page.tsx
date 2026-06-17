import React from "react";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import {
  approvalGates,
  facilitatorScript,
  finalReportChecklist,
  fixPriorityRules,
  issueLogTemplate,
  issueSeverityCards,
  quickStartSteps,
  releaseReadinessChecklist,
  roleScenarioCards,
  uatAccessCard,
} from "./uat-package-config";

export default function UatPage() {
  return (
    <PageShell
      backHref="/dashboard"
      backLabel="대시보드로"
      eyebrow="Phase 40 내부 도입 리허설 패키지"
      title="내부 도입 리허설 / UAT 패키지"
      description="직원, 승인자, 경영업무 담당자, 운영자/감사 담당자가 같은 live 환경에서 어디부터 눌러보고 무엇을 blocker/major/approval-needed 로 적을지 한 번에 정리한 실행용 패키지입니다."
      actions={
        <div className="pill-row">
          <Pill tone="accent">role-based rehearsal</Pill>
          <Pill tone="warning">approval gates kept</Pill>
        </div>
      }
    >
      <SurfaceSection title="접속 정보" description="리허설 시작 전에 모두가 같은 정보를 보고 시작합니다.">
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill tone="accent">live URL</Pill>
            <h3>{uatAccessCard.liveUrl}</h3>
            <a href={uatAccessCard.liveUrl}>{uatAccessCard.liveUrl}</a>
          </article>
          <article className="info-card">
            <Pill tone="accent">테스트 계정</Pill>
            <h3>{uatAccessCard.account}</h3>
            <p>{uatAccessCard.note}</p>
          </article>
          <article className="info-card">
            <Pill tone="warning">시작 원칙</Pill>
            <h3>홈과 운영 레인을 섞지 않기</h3>
            <p>직원은 `/dashboard`, 경영업무 담당자는 `/management`, 운영자/감사는 `/admin*` 문맥에서 시작합니다.</p>
          </article>
        </div>
      </SurfaceSection>

      <SurfaceSection title="역할별 시나리오 카드" description="단순 route 목록이 아니라 실제 행동 순서와 상태 판정 포인트를 같이 적습니다.">
        <div className="grid-auto-compact">
          {roleScenarioCards.map((card) => (
            <article key={card.role} className="info-card">
              <div className="pill-row">
                <Pill tone="accent">{card.role}</Pill>
                <Pill>{card.startRoute}</Pill>
              </div>
              <h3>{card.journey.join(" → ")}</h3>
              <p className="card-note">직접 해볼 액션</p>
              <ul className="summary-list">
                {card.actions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="card-note">happy path 확인 포인트</p>
              <ul className="summary-list">
                {card.happyPath.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="card-note">forbidden / empty / error / offline / approval-needed 확인 포인트</p>
              <ul className="summary-list">
                {card.statusChecks.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="이슈 분류 기준" description="버그와 승인 필요 항목을 섞지 않도록 severity 기준을 먼저 고정합니다.">
        <div className="grid-auto-compact">
          {issueSeverityCards.map((card) => (
            <article key={card.label} className="info-card">
              <Pill tone={card.label === "blocker" || card.label === "approval-needed" ? "warning" : "accent"}>{card.label}</Pill>
              <h3>{card.summary}</h3>
              <ul className="summary-list">
                {card.examples.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="이슈 기록 템플릿" description="참가자가 그대로 복사해서 적을 수 있는 최소 항목입니다.">
        <ol className="number-list">
          {issueLogTemplate.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </SurfaceSection>

      <SurfaceSection title="진행자용 설명 순서" description="10~15분 킥오프 때 읽어 줄 스크립트 초안입니다.">
        <ol className="number-list">
          {facilitatorScript.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </SurfaceSection>

      <SurfaceSection title="참가자용 빠른 시작" description="역할별 추천 시작점을 짧게 다시 안내합니다.">
        <ol className="number-list">
          {quickStartSteps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </SurfaceSection>

      <SurfaceSection title="Phase 45 최종 검증 / 릴리즈 묶음" description="내부 도입 최종 보고에서 live 확인, release 근거, rollback 설명을 같은 문장으로 잠그는 체크입니다.">
        <ul className="summary-list">
          {releaseReadinessChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="수정 우선순위 기준" description="리허설 종료 후 무엇부터 고칠지 같은 말로 정리합니다.">
        <ul className="summary-list">
          {fixPriorityRules.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="최종 보고 체크리스트" description="대장이 다시 눌러볼 수 있도록 final report 에 빠지면 안 되는 항목입니다.">
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill tone="accent">final report</Pill>
            <ul className="summary-list">
              {finalReportChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="info-card">
            <Pill tone="warning">approval gates</Pill>
            <ul className="summary-list">
              {approvalGates.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </SurfaceSection>
    </PageShell>
  );
}
