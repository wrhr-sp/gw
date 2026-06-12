import type { Metadata } from "next";
import type { ReactNode } from "react";

import { adminManifestHref, adminPwaManifest } from "../mobile-pwa-config";

export const metadata: Metadata = {
  title: adminPwaManifest.name,
  description: adminPwaManifest.description,
  manifest: adminManifestHref,
  applicationName: adminPwaManifest.short_name,
  appleWebApp: {
    capable: true,
    title: adminPwaManifest.short_name,
    statusBarStyle: "default",
  },
  icons: {
    icon: adminPwaManifest.icons.map((icon) => ({ url: icon.src })),
    apple: [{ url: adminPwaManifest.icons[0].src }],
  },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
