import { NextResponse } from "next/server";

function safeValue(formData: FormData, key: string) {
  const rawValue = formData.get(key);
  return typeof rawValue === "string" ? rawValue.trim() : "";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const actionType = safeValue(formData, "actionType");
  const targetUser = safeValue(formData, "targetUser") || safeValue(formData, "fullName") || "대상 사용자";

  const message =
    actionType === "create"
      ? `사용자 생성 preview 완료: ${targetUser} / ${safeValue(formData, "email")} / ${safeValue(formData, "roleCode")} (실저장 없음)`
      : actionType === "role"
        ? `권한 diff preview 완료: ${targetUser} → ${safeValue(formData, "nextRoleCodes")} / ${safeValue(formData, "capabilities")} (실저장 없음)`
        : actionType === "status"
          ? `상태 변경 preview 완료: ${targetUser} → ${safeValue(formData, "nextStatus")} / 사유: ${safeValue(formData, "reason")} (실저장 없음)`
          : `비밀번호 preview 완료: ${targetUser} / 임시 비밀번호 값은 URL·배너에 표시하지 않고 reset 안내만 검토했습니다. (실저장 없음)`;

  const redirectUrl = new URL("/admin/users", request.url);
  redirectUrl.searchParams.set("result", message);
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
