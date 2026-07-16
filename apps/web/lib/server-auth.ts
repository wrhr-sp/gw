import { authSessionResponseSchema, type AuthenticatedPrincipal } from "@werehere/contracts";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchApi } from "./api-transport";

export async function requireAuthenticatedPrincipal(): Promise<AuthenticatedPrincipal> {
  const cookieHeader = (await cookies()).toString();
  const headers = new Headers();
  if (cookieHeader) headers.set("cookie", cookieHeader);
  let response: Response;
  try {
    response = await fetchApi("/api/auth/session", {
      cache: "no-store",
      headers,
    });
  } catch {
    redirect("/login");
  }
  if (!response.ok) redirect("/login");

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    redirect("/login");
  }
  const parsed = authSessionResponseSchema.safeParse(body);
  if (!parsed.success) redirect("/login");
  return parsed.data.data.principal;
}
