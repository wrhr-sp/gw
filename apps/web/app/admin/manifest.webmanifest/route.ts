import { adminPwaManifest } from "../../mobile-pwa-config";

export async function GET() {
  return Response.json(adminPwaManifest, {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
    },
  });
}
