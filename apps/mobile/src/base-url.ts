import { nativeMobileBaseUrlPolicy } from "@gw/shared";

export type NativeMobileRuntimeMode = "production" | "uat" | "development" | "test";

export type NativeMobileRuntimeConfig = {
  mode: NativeMobileRuntimeMode;
  approvedOrigin?: string;
  devOrigin?: string;
};

export type NativeMobileApiTarget = {
  kind: "origin";
  baseUrl: string;
  mode: NativeMobileRuntimeMode;
  source: "approved-origin" | "dev-origin";
};

function normalizeOrigin(origin: string) {
  const url = new URL(origin);

  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("모바일 API origin 은 https 또는 localhost 계열만 허용합니다.");
  }

  return url.origin;
}

function pickOrigin(config: NativeMobileRuntimeConfig) {
  if (config.mode === "production") {
    if (!config.approvedOrigin) {
      throw new Error("production 모드에서는 approvedOrigin 이 반드시 필요합니다.");
    }

    return {
      source: "approved-origin" as const,
      baseUrl: normalizeOrigin(config.approvedOrigin),
    };
  }

  if (config.mode === "uat") {
    if (config.approvedOrigin) {
      return {
        source: "approved-origin" as const,
        baseUrl: normalizeOrigin(config.approvedOrigin),
      };
    }

    if (config.devOrigin) {
      return {
        source: "dev-origin" as const,
        baseUrl: normalizeOrigin(config.devOrigin),
      };
    }
  }

  if (config.mode === "development" || config.mode === "test") {
    if (config.devOrigin) {
      return {
        source: "dev-origin" as const,
        baseUrl: normalizeOrigin(config.devOrigin),
      };
    }

    if (config.approvedOrigin) {
      return {
        source: "approved-origin" as const,
        baseUrl: normalizeOrigin(config.approvedOrigin),
      };
    }
  }

  return null;
}

export function resolveNativeMobileApiTarget(config: NativeMobileRuntimeConfig): NativeMobileApiTarget {
  const origin = pickOrigin(config);

  if (origin) {
    return {
      kind: "origin",
      mode: config.mode,
      ...origin,
    };
  }


  throw new Error(
    `API target 을 결정할 수 없습니다. 정책: ${nativeMobileBaseUrlPolicy.principle}. mode=${config.mode}`,
  );
}

export function buildNativeMobileApiUrl(path: `/${string}`, config: NativeMobileRuntimeConfig) {
  const target = resolveNativeMobileApiTarget(config);
  return `${target.baseUrl}${path}`;
}
