import type { MetadataRoute } from "next";

import { generalPwaManifest } from "./mobile-pwa-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: generalPwaManifest.name,
    short_name: generalPwaManifest.short_name,
    description: generalPwaManifest.description,
    start_url: generalPwaManifest.start_url,
    scope: generalPwaManifest.scope,
    display: generalPwaManifest.display,
    orientation: generalPwaManifest.orientation,
    background_color: generalPwaManifest.background_color,
    theme_color: generalPwaManifest.theme_color,
    lang: generalPwaManifest.lang,
    categories: [...generalPwaManifest.categories],
    icons: generalPwaManifest.icons.map((icon) => ({ ...icon })),
  };
}
