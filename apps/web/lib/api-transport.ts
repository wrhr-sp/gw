import { getCloudflareContext } from "@opennextjs/cloudflare";

type ServiceFetcher = {
  fetch(request: Request): Promise<Response>;
};

type CloudflareApiEnvironment = {
  API_SERVICE?: ServiceFetcher;
};

export class ApiTransportNotConfiguredError extends Error {
  constructor() {
    super("API transport is not configured");
    this.name = "ApiTransportNotConfiguredError";
  }
}

export function configuredApiOrigin(): string | null {
  const configured = process.env.HOTEL_API_ORIGIN?.trim();
  if (!configured) return null;
  try {
    const origin = new URL(configured);
    const localHttp = origin.protocol === "http:"
      && (origin.hostname === "127.0.0.1" || origin.hostname === "localhost");
    if (origin.protocol !== "https:" && !localHttp) return null;
    if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
      return null;
    }
    return origin.toString().replace(/\/$/u, "");
  } catch {
    return null;
  }
}

async function configuredApiService(): Promise<ServiceFetcher | null> {
  try {
    const context = await getCloudflareContext({ async: true });
    const service = (context.env as CloudflareApiEnvironment).API_SERVICE;
    return service && typeof service.fetch === "function" ? service : null;
  } catch {
    return null;
  }
}

type StreamingRequestInit = RequestInit & { duplex?: "half" };

function requestInit(
  init: RequestInit,
  trustedOrigin: string | null | undefined,
): StreamingRequestInit {
  const headers = new Headers(init.headers);
  if (trustedOrigin === null) {
    headers.delete("origin");
    headers.delete("sec-fetch-site");
  } else if (trustedOrigin) {
    headers.set("origin", trustedOrigin);
    headers.set("sec-fetch-site", "same-origin");
  }
  const next: StreamingRequestInit = { ...init, headers };
  if (init.body instanceof ReadableStream) next.duplex = "half";
  return next;
}

async function fetchApiWithTrust(
  path: string,
  init: RequestInit,
  trustedOrigin: string | null | undefined,
): Promise<Response> {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new ApiTransportNotConfiguredError();
  }

  const service = await configuredApiService();
  if (service) {
    const origin = "https://api.internal";
    return service.fetch(
      new Request(
        new URL(path, origin),
        requestInit(init, trustedOrigin),
      ),
    );
  }

  const origin = configuredApiOrigin();
  if (!origin) throw new ApiTransportNotConfiguredError();
  return fetch(
    new URL(path, origin),
    requestInit(init, trustedOrigin),
  );
}

export async function fetchApi(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetchApiWithTrust(path, init, undefined);
}

function canonicalTrustedOrigin(value: string): string {
  try {
    const parsed = new URL(value);
    const localHttp = parsed.protocol === "http:"
      && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
    if (
      (parsed.protocol !== "https:" && !localHttp)
      || parsed.username
      || parsed.password
      || parsed.pathname !== "/"
      || parsed.search
      || parsed.hash
    ) {
      throw new Error("invalid trusted origin");
    }
    return parsed.origin;
  } catch {
    throw new ApiTransportNotConfiguredError();
  }
}

export async function fetchApiSameOrigin(
  path: string,
  init: RequestInit = {},
  trustedOrigin?: string,
): Promise<Response> {
  return fetchApiWithTrust(
    path,
    init,
    trustedOrigin ? canonicalTrustedOrigin(trustedOrigin) : null,
  );
}
