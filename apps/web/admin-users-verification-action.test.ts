import { describe, expect, it } from "vitest";

import { POST } from "./app/admin/users/verification-action/route";

function buildFormRequest(fields: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return new Request("http://localhost/admin/users/verification-action", {
    method: "POST",
    body: formData,
  });
}

describe("admin users verification action route", () => {
  it("uses a 303 redirect so POST verification lands back on GET /admin/users", async () => {
    const response = await POST(
      buildFormRequest({
        actionType: "create",
        fullName: "UAT 신규 사용자",
        email: "uat.user@example.com",
        roleCode: "EMPLOYEE",
      }),
    );

    expect(response.status).toBe(303);

    const location = response.headers.get("location");
    expect(location).toBeTruthy();

    const redirectUrl = new URL(location ?? "", "http://localhost");
    expect(redirectUrl.pathname).toBe("/admin/users");
    expect(redirectUrl.searchParams.get("result")).toContain("사용자 생성 검증 완료");
    expect(redirectUrl.searchParams.get("actionType")).toBe("create");
    expect(redirectUrl.searchParams.get("focus")).toContain("게시판/문서/근태 같은 일반 업무 접근 결과");
  });

  it("redacts password verification values from the redirect URL", async () => {
    const nextPassword = "Temp-1234!";
    const reason = "보안 메모는 URL에 남기면 안 됨";
    const response = await POST(
      buildFormRequest({
        actionType: "password",
        targetUser: "관리자 테스트",
        nextPassword,
        reason,
      }),
    );

    const location = response.headers.get("location");
    expect(location).toBeTruthy();

    const redirectUrl = new URL(location ?? "", "http://localhost");
    const result = redirectUrl.searchParams.get("result") ?? "";

    expect(result).toContain("비밀번호 검증 완료: 관리자 테스트");
    expect(result).toContain("임시 비밀번호 값은 URL·배너에 표시하지 않고");
    expect(result).not.toContain(nextPassword);
    expect(result).not.toContain(reason);
    expect(result).not.toContain("새 임시 비밀번호");
  });
});
