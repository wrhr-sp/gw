import { describe, expect, it } from "vitest";
import { mailMessageSendRequestSchema } from "../src/contracts";

describe("mail external delivery contracts", () => {
  it("accepts external email recipients without internal user ids", () => {
    const parsed = mailMessageSendRequestSchema.parse({
      externalToEmails: ["Customer@Naver.com"],
      externalCcEmails: ["partner@othercompany.co.kr"],
      subject: "외부메일",
      body: "<p>본문</p>",
      importance: "normal",
    });
    expect(parsed.externalToEmails).toEqual(["customer@naver.com"]);
    expect(parsed.externalCcEmails).toEqual(["partner@othercompany.co.kr"]);
  });

  it("still requires at least one internal or external recipient", () => {
    expect(() => mailMessageSendRequestSchema.parse({
      subject: "수신자 없음",
      body: "<p>본문</p>",
      importance: "normal",
    })).toThrow();
  });
});
