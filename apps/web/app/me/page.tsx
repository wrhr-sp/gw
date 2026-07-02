"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  appRoutes,
  errorResponseSchema,
  meResponseSchema,
  secondaryPasswordStatusResponseSchema,
  userPreferencesResponseSchema,
  type MeResponse,
  type SecondaryPasswordStatusResponse,
  type UserPreferencesResponse,
} from "@gw/shared";

import { FeaturePageOverflowMenu } from "../_components/feature-page-overflow-menu";
import { PageShell, Pill } from "../_components/page-shell";

type LoadState = "idle" | "loading" | "ready" | "error";
type ToastState = { tone: "accent" | "warning"; title: string; body: string } | null;

type MeData = {
  me: MeResponse["data"];
  secondary: SecondaryPasswordStatusResponse["data"] | null;
  preferences: UserPreferencesResponse["data"] | null;
};

type MeState = MeData | null;

async function readErrorMessage(response: Response) {
  const payload = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) return parsed.data.error.message;
  return `${response.status} ${response.statusText}`;
}

async function fetchJson<T>(route: string, parse: (payload: unknown) => T) {
  const response = await fetch(route, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return parse(await response.json());
}

async function fetchMeData(): Promise<MeData> {
  const [me, secondary, preferences] = await Promise.all([
    fetchJson(appRoutes.me, (payload) => {
      const parsed = meResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("내 정보 응답 형식이 계약과 맞지 않습니다.");
      return parsed.data.data;
    }),
    fetchJson(appRoutes.security.secondaryPassword, (payload) => {
      const parsed = secondaryPasswordStatusResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("2차 비밀번호 응답 형식이 계약과 맞지 않습니다.");
      return parsed.data.data;
    }),
    fetchJson(appRoutes.user.preferences, (payload) => {
      const parsed = userPreferencesResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("개인 설정 응답 형식이 계약과 맞지 않습니다.");
      return parsed.data.data;
    }),
  ]);
  return { me, secondary, preferences };
}

const roleLabel = (roles: string[]) => roles.join(" · ") || "직원";
const permissionLabel = (count: number) => `${count}개`;

export default function MePage() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [data, setData] = useState<MeState>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const user = data?.me.user ?? null;
  const session = data?.me.session ?? null;
  const preferenceKeys = useMemo(() => Object.keys(data?.preferences?.preferences ?? {}), [data?.preferences]);

  async function reloadMe() {
    setLoadState("loading");
    setToast(null);
    try {
      setData(await fetchMeData());
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setToast({ tone: "warning", title: "내 정보를 불러오지 못했습니다.", body: error instanceof Error ? error.message : "알 수 없는 오류입니다." });
    }
  }

  useEffect(() => { void reloadMe(); }, []);

  return (
    <PageShell title="내 정보" titlePlacement="content" titleHref={null}>
      <div className="feature-workspace">
        <aside className="feature-workspace__nav" aria-label="내 정보 메뉴">
          <div className="feature-workspace__nav-header">
            <h1><button className="page-shell__title-link page-shell__title-button" onClick={() => void reloadMe()} type="button">내 정보</button></h1>
            <FeaturePageOverflowMenu label="내 정보" />
          </div>
          <div className="feature-workspace__tab-list" role="tablist" aria-label="내 정보 상태">
            <button aria-selected="true" className="feature-workspace__tab" role="tab" type="button"><span>내 정보</span><strong>확인</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>보안</span><strong>점검</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>권한</span><strong>역할</strong></button>
            <button aria-selected="false" className="feature-workspace__tab" role="tab" type="button"><span>연결 업무</span><strong>바로가기</strong></button>
          </div>
        </aside>

        <section className="feature-workspace__panel" aria-labelledby="me-panel-heading">
          <div className="feature-workspace__panel-header">
            <div>
              <h2 id="me-panel-heading">내 정보</h2>
              <p>내 세션, 역할, 보안 확인, 개인 업무 연결을 실제 API 기준으로 확인합니다.</p>
            </div>
            <p className="feature-workspace__permission-hint">개인 정보는 읽기 전용 확인이며 계정·권한 변경은 관리자 승인 흐름으로 분리합니다.</p>
          </div>

          {toast ? <article className="info-card"><Pill tone={toast.tone}>확인</Pill><h3>{toast.title}</h3><p>{toast.body}</p></article> : null}

          <div className="feature-workspace__status-grid">
            <article className="feature-workspace__status feature-workspace__status--accent"><span>로그인 상태</span><strong>{loadState === "error" ? "확인 필요" : session ? "정상" : "조회 전"}</strong><p>{session ? `세션 만료 ${session.expiresAt.slice(0, 10)}` : "세션 API 응답을 기다립니다."}</p></article>
            <article className="feature-workspace__status"><span>내 역할</span><strong>{user ? roleLabel(user.roleCodes) : "조회 전"}</strong><p>{user?.employeeId ?? "사용자 API 응답 대기"}</p></article>
            <article className="feature-workspace__status"><span>확인 필요</span><strong>0건</strong><p>{`개인 설정 ${preferenceKeys.length}개`}</p></article>
          </div>

          <div className="feature-workspace__rows" aria-label="내 기본 정보">
            {loadState === "loading" ? <article className="feature-workspace__row"><div><strong>불러오는 중</strong><span>내 정보 조회</span></div><em>대기</em></article> : null}
            {!user ? <article className="feature-workspace__row"><div><strong>표시할 내 정보 없음</strong><span>현재 세션 API 응답을 기다리거나 명시 오류를 표시합니다.</span><p>샘플 계정으로 채우지 않고 실제 /api/me 결과만 반영합니다.</p></div><em>empty</em></article> : null}
            {user ? <article className="feature-workspace__row"><div><strong>기본 정보</strong><span>{`${user.fullName} · ${user.email}`}</span><p>{`회사 ${user.companyId} · 직원 ${user.employeeId}`}</p></div><em>확인</em></article> : null}
            {user ? <article className="feature-workspace__row"><div><strong>연락처</strong><span>{user.email}</span><p>휴대전화 등 민감 정보는 권한과 저장 정책이 확정된 뒤 연결합니다.</p></div><em>확인</em></article> : null}
            {user ? <article className="feature-workspace__row"><div><strong>근무 정보</strong><span>{roleLabel(user.roleCodes)}</span><p>소속/직책 상세는 /employees 와 /org 조회 결과로 연결합니다.</p></div><em>확인</em></article> : null}
            <article className="feature-workspace__row"><div><strong>내 급여명세서</strong><span>/payroll/me</span></div><em>이동</em></article>
            <article className="feature-workspace__row"><div><strong>직원 조회</strong><span>/employees</span></div><em>이동</em></article>
          </div>

          <div className="feature-workspace__rows" aria-label="보안과 권한">
            <article className="feature-workspace__row"><div><strong>보안</strong><span>{`2차 비밀번호 ${data?.secondary?.hasSecondaryPassword ? "설정됨" : "미설정 또는 조회 전"}`}</span><p>{`저장 상태 ${data?.secondary?.persistence ?? "확인 필요"}`}</p></div><em>점검</em></article>
            <article className="feature-workspace__row"><div><strong>권한</strong><span>{permissionLabel(user?.permissions.length ?? 0)}</span><p>{user ? user.permissions.slice(0, 4).join(" · ") : "권한 API 응답을 기다립니다."}</p><div className="feature-workspace__row-actions" aria-label="권한 요청"><button className="feature-workspace__row-action feature-workspace__row-action--secondary" disabled type="button">권한 요청</button></div></div><em>역할</em></article>
            <article className="feature-workspace__row"><div><strong>연결 업무</strong><span>/attendance · /leave · /payroll/me · /org</span><p>내 정보에서 이어서 확인할 개인 업무를 바로 엽니다.</p></div><em>바로가기</em></article>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
