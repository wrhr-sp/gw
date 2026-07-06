import React from "react";
import Link from "next/link";
import type { AdminUsersListResponse } from "@gw/shared";

import { PageShell, Pill, SurfaceSection } from "../../_components/page-shell";
import { adminOfflineGuidance, adminRecoveryRouteCards } from "../../mobile-pwa-config";

type AdminUsersPreview = Pick<AdminUsersListResponse["data"], "items" | "linkedScreens" | "companySettingsModel" | "audit">;

type AdminUsersPageContentProps = {
  adminUsers: AdminUsersPreview;
  actionMessage?: string | null;
  loadError?: string | null;
  loadErrorKind?: "error" | "offline" | null;
  actionType?: string | null;
  focusMessage?: string | null;
};

const accountLifecycleCards = [
  {
    title: "신규입사",
    summary: "직원 정보와 계정을 연결하고 최초 비밀번호 변경, 기본 역할, 부서/지점 접근권한을 부여합니다.",
    apiState: "실제 생성 API와 감사로그 저장이 준비된 뒤 활성화",
  },
  {
    title: "재직 중 변경",
    summary: "부서 이동, 직책 변경, 기능별 권한 변경, 관리자 권한 부여/회수를 처리합니다.",
    apiState: "변경 전/후 diff와 사유 기록이 준비된 뒤 활성화",
  },
  {
    title: "잠금/비활성화",
    summary: "보안 사고, 휴직, 임시 중지 상태에서 로그인을 차단하고 세션 회수 대상을 확인합니다.",
    apiState: "세션 회수와 상태 재조회까지 연결된 뒤 활성화",
  },
  {
    title: "퇴사 처리",
    summary: "퇴사자 로그인을 차단하고 역할, 세션, 토큰, 기능 접근권한을 회수합니다.",
    apiState: "퇴사 이벤트와 감사로그 저장이 준비된 뒤 활성화",
  },
] as const;

const permissionMatrix = [
  { feature: "메일", permissions: "보기 · 작성 · 발송 · 관리자 설정", scope: "내부 메일/외부 메일 provider 설정 분리" },
  { feature: "게시판", permissions: "보기 · 글쓰기 · 댓글 · 공지 · 관리", scope: "게시판별 공개 범위와 읽음 확인" },
  { feature: "문서함", permissions: "보기 · 업로드 · 다운로드 · 공간 관리", scope: "파일권한과 다운로드 로그" },
  { feature: "근태/휴가", permissions: "조회 · 신청 · 승인 · 정정 · 정책 관리", scope: "직원 셀프서비스와 관리자 처리 분리" },
  { feature: "전자결재", permissions: "기안 · 결재 · 반려 · 결재선 관리", scope: "결재선/문서 유형별 권한" },
  { feature: "관리자", permissions: "사용자 관리 · 권한 관리 · 감사 조회 · 보안 설정", scope: "관리자 업무 전용" },
] as const;

const adminSettingsMigrationRules = [
  "통합설정에는 내 정보, 알림, 화면 설정, 개인 2차 비밀번호처럼 개인 설정만 남깁니다.",
  "사용자 계정 생성, 권한 부여/회수, 운영 정책, 감사로그는 그룹웨어관리자 페이지로 옮깁니다.",
  "관리자 사이드바는 관리자 업무만 표시하고 기본업무·부서업무·지점관리포털 메뉴를 섞지 않습니다.",
  "저장 버튼은 실제 DB 저장, 재조회, 감사로그가 연결된 기능만 활성화합니다.",
] as const;

const statusLabels: Record<string, string> = {
  invited: "초대대기",
  active: "활성",
  locked: "잠금",
  disabled: "비활성",
  offboarded: "퇴사처리",
  suspended: "일시정지",
};

function getStatusLabel(status: string) {
  return statusLabels[status] ?? status;
}

export function AdminUsersPageContent({
  adminUsers,
  actionMessage,
  loadError,
  loadErrorKind,
  focusMessage,
}: AdminUsersPageContentProps) {
  const items = adminUsers.items;
  const totalCount = items.length;
  const activeCount = items.filter((item) => item.accountStatus === "active").length;
  const lockedCount = items.filter((item) => item.accountStatus === "locked").length;
  const offboardedCount = items.filter((item) => item.accountStatus === "offboarded" || item.employmentStatus === "offboarded").length;
  const adminCount = items.filter((item) => item.roleCodes.some((roleCode) => roleCode === "SUPER_ADMIN" || roleCode === "COMPANY_ADMIN" || roleCode === "HR_ADMIN")).length;
  const highRiskCount = items.filter((item) => item.highRiskPermissions.length > 0).length;
  const loadErrorTitle =
    loadErrorKind === "offline"
      ? "네트워크가 불안정해 사원 계정 데이터를 다시 불러와야 합니다"
      : "사원 계정 데이터를 불러오지 못했습니다";

  return (
    <PageShell
      backHref="/admin"
      backLabel="그룹웨어관리자로"
      eyebrow="관리자 업무"
      title="사원 계정 관리"
      description="신규입사부터 퇴사까지 사원 계정 생애주기와 사용자별 그룹웨어 기능 권한을 관리하는 화면입니다. 현재 목록은 실제 관리자 API 응답을 기준으로 표시합니다."
      actions={
        <div className="pill-row">
          <Pill tone="accent">실제 계정 목록</Pill>
          <Pill tone="warning">변경 작업은 감사로그 연결 후 활성화</Pill>
        </div>
      }
    >
      {actionMessage || focusMessage ? (
        <section className="status-banner" role="status">
          <strong>확인 메시지</strong>
          {actionMessage ? <span>{actionMessage}</span> : null}
          {focusMessage ? <span>{focusMessage}</span> : null}
        </section>
      ) : null}

      {loadError ? (
        <section className="status-banner status-banner--warning" role="alert">
          <strong>{loadErrorTitle}</strong>
          <span>{loadError}</span>
          {loadErrorKind === "offline" ? (
            <>
              <span>{adminOfflineGuidance.bannerBody}</span>
              <ul className="summary-list">
                {adminOfflineGuidance.retrySteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <p className="card-note">복구 경로: {adminRecoveryRouteCards.map((route) => route.href).join(" · ")}</p>
            </>
          ) : null}
        </section>
      ) : null}

      <SurfaceSection title="계정 현황" description="회사 범위의 계정 상태와 관리자 권한 보유 현황을 먼저 확인합니다.">
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill tone="accent">전체</Pill>
            <h3>{totalCount}개</h3>
            <p>현재 조회된 사원 계정 수입니다.</p>
          </article>
          <article className="info-card">
            <Pill tone="accent">활성</Pill>
            <h3>{activeCount}개</h3>
            <p>로그인 가능한 활성 계정입니다.</p>
          </article>
          <article className="info-card">
            <Pill tone="warning">잠금</Pill>
            <h3>{lockedCount}개</h3>
            <p>보안 또는 운영 사유로 확인이 필요한 계정입니다.</p>
          </article>
          <article className="info-card">
            <Pill tone="warning">퇴사/종료</Pill>
            <h3>{offboardedCount}개</h3>
            <p>로그인 차단과 권한 회수 여부를 확인해야 합니다.</p>
          </article>
          <article className="info-card">
            <Pill>관리자</Pill>
            <h3>{adminCount}개</h3>
            <p>관리자 역할을 가진 계정입니다.</p>
          </article>
          <article className="info-card">
            <Pill tone={highRiskCount > 0 ? "warning" : "accent"}>고위험 권한</Pill>
            <h3>{highRiskCount}개</h3>
            <p>감사 또는 별도 검토가 필요한 권한 보유 계정입니다.</p>
          </article>
        </div>
      </SurfaceSection>

      <SurfaceSection title="계정 생애주기" description="관리자 업무 버튼은 신규입사부터 퇴사까지 같은 계정관리 흐름 안에서 이어집니다.">
        <div className="grid-auto-compact">
          {accountLifecycleCards.map((card) => (
            <article key={card.title} className="info-card">
              <Pill tone="accent">{card.title}</Pill>
              <p>{card.summary}</p>
              <p className="card-note">활성화 기준: {card.apiState}</p>
            </article>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="현재 사원 계정 목록" description="실제 API 응답 기반으로 계정 상태, 역할, 세션, 고위험 권한을 확인합니다.">
        {items.length > 0 ? (
          <div className="grid-auto-compact">
            {items.map((item) => (
              <article key={item.userId} className="info-card">
                <Pill tone={item.highRiskPermissions.length > 0 ? "warning" : "accent"}>{item.roleCodes.join(", ")}</Pill>
                <h3>{item.fullName}</h3>
                <p>{item.email} · {item.departmentName}</p>
                <p className="meta-copy">
                  계정: {item.accountType} · {getStatusLabel(item.accountStatus)} · 직원 상태 {item.employmentStatus} · 연결 {item.employeeLinkStatus}
                </p>
                <p className="meta-copy">
                  보안: 최초 비밀번호 변경 {item.mustChangePassword ? "필요" : "완료"} · 2FA {item.twoFactorRequired ? "필수" : "미필수"} · 활성 세션 {item.activeSessionCount}개 · 로그인 실패 {item.failedLoginCount}회
                </p>
                <p className="card-note">
                  역할 변경 후보: {item.roleChangePreview.nextRoleCodes.join(", ")} · 상태 후보: {getStatusLabel(item.statusChangePreview.currentStatus)} → {getStatusLabel(item.statusChangePreview.nextStatus)}
                </p>
                <p className="card-note">고위험 권한: {item.highRiskPermissions.length > 0 ? item.highRiskPermissions.join(", ") : "없음"}</p>
              </article>
            ))}
          </div>
        ) : (
          <article className="info-card">
            <h3>조회된 계정이 없습니다</h3>
            <p>회사 범위에 사원 계정이 없거나 현재 세션 권한으로 조회 가능한 계정이 없는 상태입니다. 샘플 계정으로 대체하지 않습니다.</p>
          </article>
        )}
      </SurfaceSection>

      <div id="permission-matrix">
        <SurfaceSection
          title="사용자별 기능 세부권한"
          description="통합설정의 관리자 권한 설정은 이 관리자 페이지에서 사용자/기능/권한 단위로 관리하는 구조로 옮깁니다."
        >
          <div className="grid-auto-compact">
            {permissionMatrix.map((row) => (
              <article key={row.feature} className="info-card">
                <Pill>{row.feature}</Pill>
                <h3>{row.permissions}</h3>
                <p>{row.scope}</p>
              </article>
            ))}
          </div>
        </SurfaceSection>
      </div>

      <SurfaceSection title="관리자 설정 이관 기준" description="개인 설정과 관리자 설정의 위치를 분리합니다." muted>
        <ul className="summary-list">
          {adminSettingsMigrationRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </SurfaceSection>

      <SurfaceSection title="비활성 관리자 작업" description="아직 실제 저장·재조회·감사로그가 연결되지 않은 변경 작업은 성공처럼 보이지 않게 비활성 상태로 둡니다.">
        <div className="grid-auto-compact">
          <article className="info-card">
            <Pill tone="warning">준비 중</Pill>
            <h3>사원 계정 생성</h3>
            <p>계정 생성 API, 비밀번호 hash 저장, 생성 후 재조회, 감사로그 기록이 연결되면 활성화합니다.</p>
          </article>
          <article className="info-card">
            <Pill tone="warning">준비 중</Pill>
            <h3>권한 저장</h3>
            <p>역할/권한 변경 API, 변경 전후 diff, 사유 입력, permission change log가 연결되면 활성화합니다.</p>
          </article>
          <article className="info-card">
            <Pill tone="warning">준비 중</Pill>
            <h3>퇴사 처리</h3>
            <p>로그인 차단, 세션 회수, 토큰 회수, 상태 재조회, 감사로그 기록이 연결되면 활성화합니다.</p>
          </article>
        </div>
      </SurfaceSection>

      <SurfaceSection title="연결 화면" description="관리자 계정 관리와 함께 확인할 실제 화면입니다.">
        <div className="grid-auto-compact">
          {adminUsers.linkedScreens.map((item) => (
            <article key={`${item.source}-${item.title}`} className="info-card">
              <Pill>{item.category}</Pill>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <p className="card-note">출처: {item.source}</p>
            </article>
          ))}
          <article className="route-card">
            <Pill tone="accent">감사</Pill>
            <h3>감사로그</h3>
            <p>권한 변경과 계정 상태 변경은 감사로그와 함께 확인해야 합니다.</p>
            <Link href="/admin/audit-logs">감사로그 보기 →</Link>
          </article>
        </div>
      </SurfaceSection>
    </PageShell>
  );
}
