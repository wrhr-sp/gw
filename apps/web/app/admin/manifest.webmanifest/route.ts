import { adminPwaManifest } from "../../mobile-pwa-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return Response.json(adminPwaManifest, {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });
}
