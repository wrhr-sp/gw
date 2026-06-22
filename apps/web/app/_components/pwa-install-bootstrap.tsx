"use client";

import { useEffect } from "react";

export function PwaInstallBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => registration.update())
      .catch(() => {
        // installability bootstrap failure should not break page rendering
      });
  }, []);

  return null;
}
