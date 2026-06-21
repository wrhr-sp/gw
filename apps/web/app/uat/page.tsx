import React from "react";

import { PageShell, Pill, SurfaceSection } from "../_components/page-shell";
import {
  approvalGates,
  facilitatorScript,
  finalReportChecklist,
  fixPriorityRules,
  issueLogTemplate,
  issueSeverityCards,
  phase60ReleaseRouteCards,
  quickStartSteps,
  releaseReadinessChecklist,
  roleScenarioCards,
  uatAccessCard,
} from "./uat-package-config";
import {
  phase59AdminGuideCards,
  phase59AiCandidateNotes,
  phase59GuideDocumentLinks,
  phase59HelpEntryCards,
  phase59RoleLabels,
  phase59RoleMatrixCards,
  phase59ScenarioBundles,
} from "./phase59-uat-config";

export default function UatPage() {
  return (
    <PageShell
      backHref="/dashboard"
      backLabel="대시보드로"
      eyebrow="Phase 60 실사용 1차 내부 릴리즈 패키지"
      title="실사용 1차 내부 릴리즈 / UAT 패키지"
      titleHref="/uat"
      description="직원, 승인자, 경영업무 담당자, 운영자/감사 담당자가 같은 live 환경에서 어디부터 눌러보고 무엇을 blocker/major/approval-needed 로 적을지, 그리고 Phase 60 기준선에서 무엇이 아직 dev-safe/approval gate 인지 한 번에 정리한 실행용 패키지입니다."
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

      <SurfaceSection title="Phase 60 빠른 entry" description="로그인 뒤 어떤 역할로 어디부터 눌러야 하는지, 도움말과 운영 안내 흐름을 이번 릴리즈 기준선에 맞춰 다시 묶습니다.">
        <div className="grid-auto-compact">
          {phase59HelpEntryCards.map((card) => (
            <article key={card.title} className="info-card">
              <Pill tone="accent">{card.route}</Pill>
              <h3>{card.title}</h3>
              <p>{card.summary}</p>
              <p className="card-note">{card.followUp}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="관련 기능 가이드 링크" description="기능별 live route 와 참고 문서를 같은 카드에 붙여, 대장이 기능 문서를 다시 뒤적이지 않고 바로 따라갈 수 있게 정리합니다.">
        <div className="grid-auto-compact">
          {phase59GuideDocumentLinks.map((item) => (
            <article key={item.docPath} className="info-card">
              <Pill tone="accent">{item.route}</Pill>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <p className="card-note">
                참고 문서: <a href={item.docHref}>{item.title}</a>
              </p>
              <p className="meta-copy">repo guides 문서 기준으로 함께 검토합니다.</p>
            </article>
          ))}
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
              <p className="card-note">forbidden / empty / error / loading / mobile/PC / approval-needed 확인 포인트</p>
              <ul className="summary-list">
                {card.statusChecks.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="시나리오 A~F 묶음" description="기능 소개 대신 실제 UAT 기록에 필요한 업무 묶음과 상태 포인트를 먼저 정리합니다.">
        <div className="grid-auto-compact">
          {phase59ScenarioBundles.map((item) => (
            <article key={item.title} className="info-card">
              <Pill>{item.roles}</Pill>
              <h3>{item.title}</h3>
              <p>{item.route}</p>
              <p className="card-note">happy path: {item.happyPath}</p>
              <p className="card-note">상태/차단: {item.stateFocus}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="역할별 검증표" description="보여야 하는 것, 보이면 안 되는 것, 막혀야 하는 것, 기록할 상태를 같은 포맷으로 고정합니다.">
        <div className="grid-auto-compact">
          {phase59RoleMatrixCards.map((item) => (
            <article key={item.role} className="info-card">
              <Pill tone="accent">{phase59RoleLabels[item.role]}</Pill>
              <h3>{item.shouldSee}</h3>
              <ul className="summary-list">
                <li>보이면 안 되는 것: {item.shouldNotSee}</li>
                <li>막혀야 하는 것: {item.mustBlock}</li>
                <li>기록할 상태: {item.recordStates}</li>
              </ul>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="사용자 도움말 / 관리자 안내 흐름" description="직원용 도움말 entry 와 관리자 운영 안내 흐름을 같은 패키지 안에서 연결합니다.">
        <div className="grid-auto-compact">
          {phase59AdminGuideCards.map((item) => (
            <article key={item.title} className="info-card">
              <div className="pill-row">
                <Pill tone="warning">관리자 안내</Pill>
                <Pill tone="accent">{item.visibleTo.map((role) => phase59RoleLabels[role]).join(" · ")}</Pill>
              </div>
              <h3>{item.title}</h3>
              <p>{item.route}</p>
              <p className="card-note">{item.summary}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection
        title="Phase 60 기능별 릴리즈 기준선"
        description="최종 구현 handoff 와 리뷰·통합 보고가 같은 표를 보도록 route, 대상 역할, 직접 할 액션, happy path, 상태 확인, dev-safe, approval gate 를 같은 순서로 고정합니다."
      >
        <div className="grid-auto-compact">
          {phase60ReleaseRouteCards.map((card) => (
            <article key={card.title} className="info-card">
              <div className="pill-row">
                <Pill tone="accent">{card.audience}</Pill>
                <Pill>{card.route}</Pill>
              </div>
              <h3>{card.title}</h3>
              <ul className="summary-list">
                <li>직접 할 액션: {card.action}</li>
                <li>happy path 결과: {card.happyPath}</li>
                <li>상태 확인: {card.stateChecks}</li>
                <li>아직 dev-safe 인 부분: {card.devSafe}</li>
                <li>approval-needed: {card.approvalNeeded}</li>
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

      <SurfaceSection title="Phase 60 최종 검증 / 릴리즈 묶음" description="실사용 1차 내부 릴리즈 최종 보고에서 live 확인, release 근거, rollback 설명을 같은 문장으로 잠그는 체크입니다.">
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

      <SurfaceSection title="AI 챗봇 후보 안내" description="이번 Phase 에서는 실제 AI 연동 대신, 향후 사용자/관리자 안내에 넣을 후보 문장만 남깁니다.">
        <ul className="summary-list">
          {phase59AiCandidateNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceSection>
    </PageShell>
  );
}
