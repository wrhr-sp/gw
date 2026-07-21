import { describe, expect, it } from "vitest";
import { parseResolvedPrincipalRows } from "../src/auth";

const principalRow = {
  company_id: "10000000-0000-4000-8000-000000000001",
  identity_id: "20000000-0000-4000-8000-000000000001",
  session_id: "30000000-0000-4000-8000-000000000001",
  user_id: "40000000-0000-4000-8000-000000000001",
  user_type: "INTERNAL_STAFF" as const,
  display_name: "테스트 관리자",
  must_change_password: false,
};

describe("auth resolve result contract", () => {
  it("accepts zero rows as an unauthenticated session", () => {
    expect(parseResolvedPrincipalRows([])).toBeNull();
  });

  it("maps exactly one complete principal", () => {
    expect(parseResolvedPrincipalRows([principalRow])).toEqual({
      companyId: principalRow.company_id,
      identityId: principalRow.identity_id,
      sessionId: principalRow.session_id,
      userId: principalRow.user_id,
      userType: "INTERNAL_STAFF",
      displayName: principalRow.display_name,
      mustChangePassword: false,
    });
  });

  it("rejects multiple or incomplete rows instead of accepting the first row", () => {
    expect(() =>
      parseResolvedPrincipalRows([principalRow, principalRow]),
    ).toThrow("multiple rows");
    expect(() =>
      parseResolvedPrincipalRows([{ ...principalRow, session_id: null }]),
    ).toThrow("incomplete principal");
    expect(() =>
      parseResolvedPrincipalRows([
        { ...principalRow, must_change_password: null },
      ]),
    ).toThrow("incomplete principal");
  });
});
