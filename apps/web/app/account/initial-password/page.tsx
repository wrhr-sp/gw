import { redirect } from "next/navigation";
import { InitialPasswordForm } from "../../../components/accounts/initial-password-form";
import { InitialPasswordPageShell } from "../../../components/accounts/initial-password-page-shell";
import { requireAuthenticatedPrincipal } from "../../../lib/server-auth";

export const dynamic = "force-dynamic";

export default async function InitialPasswordPage() {
  const principal = await requireAuthenticatedPrincipal({
    allowPasswordChange: true,
  });
  if (principal.mustChangePassword !== true) redirect("/hotel-operations");
  return (
    <InitialPasswordPageShell displayName={principal.displayName}>
      <InitialPasswordForm />
    </InitialPasswordPageShell>
  );
}
