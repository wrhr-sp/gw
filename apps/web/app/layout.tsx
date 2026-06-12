import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { getTrustedHostFromHeaders } from "../admin-host";

import { getPwaManifestForHost, getAppShellConfigForHost } from "./mobile-pwa-config";

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
    manifest: "/manifest.webmanifest",
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
  const shellConfig = getAppShellConfigForHost(host);

  return (
    <html lang="ko">
      <body>
        <MobileAppShell {...shellConfig}>{children}</MobileAppShell>
      </body>
    </html>
  );
}
