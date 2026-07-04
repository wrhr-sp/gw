import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const mailClient = readFileSync(new URL("./app/mail/mail-client.tsx", import.meta.url), "utf8");
const globalCss = readFileSync(new URL("./app/globals.css", import.meta.url), "utf8");

describe("mail detail, reply, and forward UI", () => {
  it("renders a selectable detail panel with reply/reply-all/forward actions", () => {
    expect(mailClient).toContain("mail-detail-layout");
    expect(mailClient).toContain("mail-detail-panel");
    expect(mailClient).toContain("메일 상세 작업");
    expect(mailClient).toContain('openComposeFromMessage("reply", selectedMessage)');
    expect(mailClient).toContain('openComposeFromMessage("replyAll", selectedMessage)');
    expect(mailClient).toContain('openComposeFromMessage("forward", selectedMessage)');
  });

  it("prevents plain Enter in compose inputs from submitting mail", () => {
    expect(mailClient).toContain("function handleComposeKeyDown");
    expect(mailClient).toContain("onKeyDown={handleComposeKeyDown}");
    expect(mailClient).toContain('event.key !== "Enter"');
    expect(mailClient).toContain("event.preventDefault()");
  });

  it("styles the detail panel without creating a separate mail route", () => {
    expect(globalCss).toContain(".mail-detail-layout");
    expect(globalCss).toContain(".mail-message-select-button");
    expect(globalCss).toContain(".mail-detail-panel__actions");
  });
});
