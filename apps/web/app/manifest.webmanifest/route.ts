import { headers } from "next/headers";

import { getTrustedHostFromHeaders } from "../../admin-host";

import { getPwaManifestForHost } from "../mobile-pwa-config";

export async function GET() {
  const requestHeaders = await headers();
  const host = getTrustedHostFromHeaders(requestHeaders);
  const manifest = getPwaManifestForHost(host);

  return Response.json(manifest, {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
    },
  });
}
