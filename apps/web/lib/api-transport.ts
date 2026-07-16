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

export async function fetchApi(path: string, init: RequestInit = {}): Promise<Response> {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new ApiTransportNotConfiguredError();
  }

  const service = await configuredApiService();
  if (service) {
    return service.fetch(new Request(new URL(path, "https://api.internal"), init));
  }

  const origin = configuredApiOrigin();
  if (!origin) throw new ApiTransportNotConfiguredError();
  return fetch(new URL(path, origin), init);
}
