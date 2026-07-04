import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mailClient = readFileSync(new URL("./app/mail/mail-client.tsx", import.meta.url), "utf8");
const globalCss = readFileSync(new URL("./app/globals.css", import.meta.url), "utf8");

describe("mail compose address and attachment UX", () => {
  it("removes compose helper copy and keeps recipient recent buttons inside both inputs", () => {
    expect(mailClient).not.toContain("수신자, 제목, 본문을 입력한 뒤 실제 메일 API로 저장·발송합니다.");
    expect(mailClient).toContain("mail-recipient-input-shell");
    expect(mailClient).toContain("받는사람 최근 사용 주소");
    expect(mailClient).toContain("참조 최근 사용 주소");
    expect(mailClient).toContain("renderRecentRecipientPopover");
    expect(globalCss).toContain(".mail-recipient-input-shell .field");
    expect(globalCss).toContain(".mail-recipient-recent-button");
  });

  it("supports drag and drop attachments and immediate pre-send upload", () => {
    expect(mailClient).toContain("handleAttachmentDragOver");
    expect(mailClient).toContain("handleAttachmentDrop");
    expect(mailClient).toContain("드래그앤드롭 파일첨부");
    expect(mailClient).toContain("ensureComposeDraftMessage");
    expect(mailClient).toContain("status: \"업로드 중\" as const");
    expect(mailClient).toContain("uploadedAttachmentId: uploaded.data.attachment.id");
    expect(mailClient).toContain("첨부파일 업로드가 끝난 뒤 보낼 수 있습니다.");
    expect(mailClient).toContain("sourceDraftMessageId: composeDraftMessageId ?? undefined");
    expect(globalCss).toContain(".mail-compose-attachments--drag-over");
  });

  it("registers manually entered external emails with Enter and blocks send until SMTP/API is connected", () => {
    expect(mailClient).toContain("type MailExternalRecipient");
    expect(mailClient).toContain("handleRecipientInputKeyDown(event, \"to\")");
    expect(mailClient).toContain("handleRecipientInputKeyDown(event, \"cc\")");
    expect(mailClient).toContain("addExternalEmailRecipient(query, target)");
    expect(mailClient).toContain("올바른 이메일 주소를 입력해주세요.");
    expect(mailClient).toContain("이미 추가된 이메일입니다.");
    expect(mailClient).toContain("externalToEmails: externalRecipientEmails.map((recipient) => recipient.email)");
    expect(mailClient).toContain("externalCcEmails: externalCcEmails.map((recipient) => recipient.email)");
    expect(mailClient).toContain("외부 이메일 실제 발송은 다음 SMTP/API 연동 단계에서 연결합니다.");
  });

  it("renders mail integration settings for personal, virtual, and alias accounts", () => {
    expect(mailClient).toContain("메일 통합설정");
    expect(mailClient).toContain("내 메일 · 가상메일 등록");
    expect(mailClient).toContain("별칭계정 등록");
    expect(mailClient).toContain("가상메일은 세금계산서 수취 전용메일처럼 실제 사람이 아니라 업무 목적 주소입니다.");
    expect(mailClient).toContain("SMTP/API provider는 미연결 상태로 저장");
    expect(mailClient).toContain("appRoutes.mail.accounts");
    expect(mailClient).toContain("appRoutes.mail.aliases");
    expect(mailClient).toContain("보낸사람 계정");
    expect(mailClient).toContain("senderMailAccountId: selectedSenderOption?.accountId || undefined");
    expect(mailClient).toContain("senderMailAliasId: selectedSenderOption?.aliasId || undefined");
    expect(mailClient).toContain("SMTP/API 연결 전까지 발신주소 선택값만 저장됩니다.");
    expect(globalCss).toContain(".mail-integration-settings");
    expect(globalCss).toContain(".mail-settings-grid");
  });
});
