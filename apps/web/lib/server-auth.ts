import { authSessionResponseSchema, type AuthenticatedPrincipal } from "@werehere/contracts";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function configuredApiOrigin(): string | null {
  const configured = process.env.HOTEL_API_ORIGIN?.trim();
  if (!configured) return null;
  try {
    const origin = new URL(configured);
    const localHttp = origin.protocol === "http:"
      && (origin.hostname === "127.0.0.1" || origin.hostname === "localhost");
    if (origin.protocol !== "https:" && !localHttp) return null;
    if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
      return null;
    }
    return origin.toString().replace(/\/$/u, "");
  } catch {
    return null;
  }
}

export async function requireAuthenticatedPrincipal(): Promise<AuthenticatedPrincipal> {
  const apiOrigin = configuredApiOrigin();
  if (!apiOrigin) redirect("/login");

  const cookieHeader = (await cookies()).toString();
  const headers = new Headers();
  if (cookieHeader) headers.set("cookie", cookieHeader);
  let response: Response;
  try {
    response = await fetch(`${apiOrigin}/api/auth/session`, {
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
