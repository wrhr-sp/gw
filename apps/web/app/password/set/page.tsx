import { cookies } from "next/headers";
import { PasswordResetCard, type PasswordResetMode } from "../../../components/auth/password-reset-card";

const ERROR_MESSAGES: Record<string, string> = {
  "invalid-link": "비밀번호 재설정 링크가 만료되었거나 올바르지 않습니다. 새 재설정 메일을 요청해 주세요.",
  "password-mismatch": "새 비밀번호와 비밀번호 확인이 일치하지 않습니다.",
  "password-policy": "비밀번호는 8자 이상이며 영문, 숫자, 기호를 각각 포함해야 합니다.",
  "password-rejected": "새 비밀번호가 보안 정책에 맞지 않습니다. 다른 비밀번호로 다시 시도해 주세요.",
  "exchange-unavailable": "재설정 링크를 확인할 수 없습니다. 잠시 후 같은 재설정 메일 링크를 다시 열어 주세요.",
  unavailable: "비밀번호 서비스에 연결할 수 없습니다. 잠시 후 같은 재설정 메일 링크를 다시 열어 주세요.",
};

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function PasswordSetPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const error = single(params?.error);
  const hasResetCookie = cookieStore.has("__Host-hotel_password_reset");
  const exchangePending = cookieStore.has("__Host-hotel_password_reset_exchange_pending");
  const terminalError = error === "invalid-link" || error === "exchange-unavailable";
  const effectiveError = error ?? (exchangePending ? "invalid-link" : undefined);
  const mode: PasswordResetMode = terminalError || exchangePending
    ? "invalid"
    : hasResetCookie ? "form"
      : error ? "invalid" : "exchange";
  return (
    <PasswordResetCard
      errorCode={effectiveError}
      errorMessage={effectiveError ? ERROR_MESSAGES[effectiveError] ?? ERROR_MESSAGES["invalid-link"] : undefined}
      mode={mode}
    />
  );
}
