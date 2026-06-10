import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { MobileAppShell } from "./_components/mobile-app-shell";
import { pwaManifest } from "./mobile-pwa-config";

import "./globals.css";

export const metadata: Metadata = {
  title: "GW Cloudflare-first Skeleton",
  description: pwaManifest.description,
  manifest: "/manifest.webmanifest",
  applicationName: pwaManifest.short_name,
  appleWebApp: {
    capable: true,
    title: pwaManifest.short_name,
    statusBarStyle: "default",
  },
  icons: {
    icon: pwaManifest.icons.map((icon) => ({ url: icon.src })),
    apple: [{ url: "/icons/icon-192.svg" }],
  },
};

export const viewport: Viewport = {
  themeColor: pwaManifest.theme_color,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <MobileAppShell>{children}</MobileAppShell>
      </body>
    </html>
  );
}
