import { NextResponse } from "next/server";

function safeValue(formData: FormData, key: string) {
  const rawValue = formData.get(key);
  return typeof rawValue === "string" ? rawValue.trim() : "";
}

const actionFocusMap = {
  create: "생성 검증 후 게시판/문서/근태 같은 일반 업무 접근 결과를 바로 확인합니다.",
  role: "권한 변경점 검증 뒤 /management, /admin/users, /admin/audit-logs 접근 결과를 다시 눌러봅니다.",
  status: "상태 변경 검증 뒤 비활성 사용자 차단과 감사 후보 문구를 함께 확인합니다.",
  password: "비밀번호 초기화 검증 뒤 실제 비밀번호 값은 남기지 않고 로그아웃/재로그인 시나리오만 점검합니다.",
} as const;

export async function POST(request: Request) {
  const formData = await request.formData();
  const actionType = safeValue(formData, "actionType");
  const targetUser = safeValue(formData, "targetUser") || safeValue(formData, "fullName") || "대상 사용자";

  const message =
    actionType === "create"
      ? `사용자 생성 검증 완료: ${targetUser} / ${safeValue(formData, "email")} / ${safeValue(formData, "roleCode")} (실저장 없음)`
      : actionType === "role"
        ? `권한 변경점 검증 완료: ${targetUser} → ${safeValue(formData, "nextRoleCodes")} / ${safeValue(formData, "capabilities")} (실저장 없음)`
        : actionType === "status"
          ? `상태 변경 검증 완료: ${targetUser} → ${safeValue(formData, "nextStatus")} / 사유: ${safeValue(formData, "reason")} (실저장 없음)`
          : `비밀번호 검증 완료: ${targetUser} / 임시 비밀번호 값은 URL·배너에 표시하지 않고 초기화 안내만 검토했습니다. (실저장 없음)`;

  const redirectUrl = new URL("/admin/users", request.url);
  redirectUrl.searchParams.set("result", message);
  redirectUrl.searchParams.set("actionType", actionType || "password");
  redirectUrl.searchParams.set("focus", actionFocusMap[actionType as keyof typeof actionFocusMap] ?? actionFocusMap.password);
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
