import React from "react";
import type { HomeShortcut } from "@gw/shared";

import { Pill } from "./page-shell";

function splitHomeShortcuts(homeShortcuts: readonly HomeShortcut[]) {
  return {
    fixedShortcuts: homeShortcuts.filter((item) => item.isFixed || item.scope === "company"),
    userScopedShortcuts: homeShortcuts.filter((item) => !item.isFixed && item.scope === "user"),
  };
}

export function HomeShortcutsPanel({
  homeShortcuts,
  homeShortcutNotices,
  homeShortcutLoadError,
  emptyFixedMessage = "로그인 전에는 고정 바로가기 API를 읽지 않습니다.",
  emptyCustomMessage = "현재 세션 권한으로 열리는 사용자 전용 바로가기가 없으면 이 상태를 그대로 보여 줍니다.",
}: {
  homeShortcuts?: readonly HomeShortcut[];
  homeShortcutNotices?: readonly string[];
  homeShortcutLoadError?: string | null;
  emptyFixedMessage?: string;
  emptyCustomMessage?: string;
}) {
  const { fixedShortcuts, userScopedShortcuts } = splitHomeShortcuts(homeShortcuts ?? []);

  return (
    <>
      {homeShortcutLoadError ? (
        <section className="status-banner status-banner--warning" role="alert">
          <strong>홈 바로가기를 불러오지 못했습니다</strong>
          <span>{homeShortcutLoadError}</span>
          <small>잠시 후 `/dashboard` 또는 `/menu` 를 새로 열어 다시 확인하고, 네트워크가 불안정하면 `/offline` 안내를 먼저 봅니다.</small>
        </section>
      ) : null}
      <div className="grid-auto-compact">
        <article className="info-card">
          <Pill tone="accent">회사 공통 고정</Pill>
          <h3>{fixedShortcuts.length > 0 ? `${fixedShortcuts.length}개` : "로그인 뒤 노출"}</h3>
          <p>근태·휴가·결재처럼 모두가 같은 순서로 찾는 기본 업무를 고정합니다.</p>
          {fixedShortcuts.length > 0 ? (
            <ul className="summary-list">
              {fixedShortcuts.map((item) => (
                <li key={item.id}>
                  <a href={item.href}>{item.label}</a> · {item.href}
                </li>
              ))}
            </ul>
          ) : (
            <p className="card-note">{emptyFixedMessage}</p>
          )}
        </article>
        <article className="info-card">
          <Pill tone="warning">권한 기반 사용자 전용</Pill>
          <h3>{userScopedShortcuts.length > 0 ? `${userScopedShortcuts.length}개` : "추가 권한 없음"}</h3>
          <p>관리자·감사·경영업무처럼 현재 세션 권한으로만 열리는 개인 전용 진입점을 분리합니다.</p>
          {userScopedShortcuts.length > 0 ? (
            <ul className="summary-list">
              {userScopedShortcuts.map((item) => (
                <li key={item.id}>
                  <a href={item.href}>{item.label}</a> · {item.href}
                </li>
              ))}
            </ul>
          ) : (
            <p className="card-note">{emptyCustomMessage}</p>
          )}
        </article>
      </div>
      {homeShortcutNotices && homeShortcutNotices.length > 0 ? (
        <ul className="summary-list">
          {homeShortcutNotices.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
