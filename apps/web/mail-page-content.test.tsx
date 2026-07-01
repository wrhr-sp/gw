import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MailPage from "./app/mail/page";

describe("mail page content", () => {
  it("renders the default mail folder tree and common feature page menu", () => {
    const html = renderToStaticMarkup(<MailPage />);

    expect(html).toContain("메일");
    expect(html).toContain('aria-label="메일 더보기 메뉴 열기"');
    expect(html).toContain("가이드");
    expect(html).toContain("통합설정");
    expect(html).not.toContain('aria-label="메일 목록 편집"');
    expect(html).not.toContain(">설정</button>");
    expect(html).toContain('aria-label="메일함 목록"');
    expect(html).toContain("즐겨찾기");
    expect(html).toContain('aria-label="메일함"');
    expect(html).toContain("받은메일함");
    expect(html).toContain("보낸메일함");
    expect(html).toContain("임시보관함");
    expect(html).toContain("예약메일함");
    expect(html).toContain("스팸메일함");
    expect(html).toContain('aria-label="외부메일함"');
    expect(html).toContain('aria-label="휴지통"');
    expect(html).not.toContain("ㄴ받은메일함");
    expect(html).not.toContain("받은 메일함");
    expect(html).not.toContain('aria-label="요약 정보"');
    expect(html.indexOf('aria-label="외부메일함"')).toBeLessThan(html.indexOf('aria-label="휴지통"'));
  });

  it("uses the board write button token for the mail compose button", () => {
    const html = renderToStaticMarkup(<MailPage />);
    const source = readFileSync("app/mail/mail-client.tsx", "utf8");
    const globalCss = readFileSync("app/globals.css", "utf8");

    expect(html).toContain('class="board-write-button mail-write-button"');
    expect(html).toContain("메일쓰기");
    expect(source).toContain('className="board-write-button mail-write-button"');
    expect(source).toContain('className="mail-compose-form"');
    expect(source).toContain("예약발송");
    expect(source).toContain("임시저장");
    expect(source).toContain("미리보기");
    expect(source).toContain("템플릿");
    expect(source).toContain("내게쓰기");
    expect(source).toContain("문서함에서 선택");
    expect(source).toContain("받는사람 이메일 또는 이름");
    expect(source).toContain("FeatureFileAttachmentBox");
    expect(source).toContain("appRoutes.mail.recipients");
    expect(source).toContain("appRoutes.documents.files");
    expect(source).toContain("init={boardTinymceInit}");
    expect(source).toContain("appRoutes.mail.saveDraft");
    expect(source).not.toContain("메일 작성 화면입니다.");
    expect(source).not.toContain("메일 작성화면입니다.");
    expect(source).not.toContain("<textarea aria-label=\"본문\"");
    expect(source).not.toContain("실제 첨부 업로드");
    expect(source).not.toContain("개인 자료실");
    expect(globalCss).toContain(".board-write-button,");
    expect(globalCss).toContain("background: var(--feature-page-write-button-background)");
    expect(globalCss).toContain("--feature-page-write-button-background: var(--board-write-button-background);");
    expect(globalCss).toContain(".mail-write-button");
    expect(globalCss).toContain(".mail-compose-form");
    expect(globalCss).toContain(".mail-compose-toolbar");
    expect(globalCss).toContain(".feature-file-box__header");
    expect(globalCss).toContain("grid-template-columns: 36px minmax(0, 1fr) minmax(96px, max-content) minmax(72px, max-content) minmax(84px, max-content);");
    expect(globalCss).toContain(".mail-recipient-combobox");
    expect(globalCss).toContain(".mail-document-picker");
  });
});
