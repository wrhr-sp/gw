import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "GW Cloudflare-first Skeleton",
  description: "OpenNext on Cloudflare 기반 그룹웨어 Web/PWA 스켈레톤",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f3f4f6", color: "#111827" }}>
        {children}
      </body>
    </html>
  );
}
