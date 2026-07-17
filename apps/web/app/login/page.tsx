import { HotelLoginCard } from "../../components/auth/hotel-login-card";

const ERROR_MESSAGES: Record<string, string> = {
  "invalid-credentials": "아이디 또는 비밀번호를 확인해 주세요.",
  "invalid-flow": "로그인 요청이 만료되었거나 올바르지 않습니다. 다시 시작해 주세요.",
  "mfa-required": "이 계정은 추가 인증이 필요합니다. 현재 로그인 방식에서는 관리자에게 문의해 주세요.",
  "rate-limited": "로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
  unavailable: "로그인 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
};

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const authRequestValue = single(params?.authRequest);
  const authRequest = authRequestValue && /^[A-Za-z0-9_-]{1,200}$/u.test(authRequestValue)
    ? authRequestValue
    : undefined;
  const csrfValue = single(params?.csrf);
  const csrf = csrfValue && /^[A-Za-z0-9_-]{43}$/u.test(csrfValue) ? csrfValue : undefined;
  const error = single(params?.error);
  return <HotelLoginCard
    authRequest={authRequest && csrf ? authRequest : undefined}
    csrf={authRequest && csrf ? csrf : undefined}
    errorMessage={error ? ERROR_MESSAGES[error] : undefined}
  />;
}
