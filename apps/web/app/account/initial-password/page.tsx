import { redirect } from "next/navigation";
import { InitialPasswordForm } from "../../../components/accounts/initial-password-form";
import { requireAuthenticatedPrincipal } from "../../../lib/server-auth";

export const dynamic = "force-dynamic";

export default async function InitialPasswordPage() {
  const principal = await requireAuthenticatedPrincipal({ allowPasswordChange: true });
  if (principal.mustChangePassword !== true) redirect("/hotel-operations");
  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
    <section className="w-full max-w-md rounded-panel border border-border bg-surface p-6 shadow-sm md:p-8">
      <p className="text-sm font-semibold text-primary">We’reHere 호텔관리</p>
      <h1 className="mt-2 text-2xl font-bold text-text">임시 비밀번호 변경</h1>
      <p className="mt-2 text-sm leading-6 text-muted">{principal.displayName}님, 호텔관리 기능을 사용하기 전에 본인만 아는 새 비밀번호로 변경해 주세요.</p>
      <InitialPasswordForm />
    </section>
  </main>;
}
