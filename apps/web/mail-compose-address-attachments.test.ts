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

  it("starts document-file download from the download init URL and explains unsupported external email", () => {
    expect(mailClient).toContain("parsed.data.action.downloadUrl");
    expect(mailClient).toContain("window.location.href = parsed.data.action.downloadUrl");
    expect(mailClient).toContain("외부 이메일 발송은 아직 연결되지 않았습니다");
  });
});
