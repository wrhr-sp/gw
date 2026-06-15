import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";

import { extractViewerRoleCodeFromSessionToken } from "../admin-page-access";
import { getTrustedHostFromHeaders } from "../admin-host";

import { getPwaManifestForHost, getManifestHrefForHost, getAppShellConfigForHost } from "./mobile-pwa-config";

import { MobileAppShell } from "./_components/mobile-app-shell";

import "./globals.css";

async function getRequestHost() {
  const requestHeaders = await headers();
  return getTrustedHostFromHeaders(requestHeaders);
}

export async function generateMetadata(): Promise<Metadata> {
  const host = await getRequestHost();
  const manifest = getPwaManifestForHost(host);

  return {
    title: manifest.name,
    description: manifest.description,
    applicationName: manifest.short_name,
    appleWebApp: {
      capable: true,
      title: manifest.short_name,
      statusBarStyle: "default",
    },
    icons: {
      icon: manifest.icons.map((icon) => ({ url: icon.src })),
      apple: [{ url: manifest.icons[0].src }],
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const host = await getRequestHost();
  const manifest = getPwaManifestForHost(host);

  return {
    themeColor: manifest.theme_color,
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const host = await getRequestHost();
  const cookieStore = await cookies();
  const roleCode = extractViewerRoleCodeFromSessionToken(cookieStore.get("gw_session")?.value ?? null);
  const manifestHref = getManifestHrefForHost(host);
  const shellConfig = getAppShellConfigForHost(host, roleCode);

  return (
    <html lang="ko">
      <head>
        <link rel="manifest" href={manifestHref} />
      </head>
      <body>
        <MobileAppShell {...shellConfig} currentRoleCode={roleCode}>
          {children}
        </MobileAppShell>
      </body>
    </html>
  );
}
