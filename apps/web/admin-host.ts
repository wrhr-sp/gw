type HostClassification = {
  rawHost: string;
  normalizedHost: string;
  hostname: string;
  port: string | null;
  isAdminHost: boolean;
  isConfiguredAdminHost: boolean;
  isPreviewAdminHost: boolean;
  isLocalAdminHost: boolean;
};

const CONFIGURED_ADMIN_HOSTS_ENV = "GW_ADMIN_HOSTS";
const LOCAL_ADMIN_HOST_PAIRS = new Map([
  ["localhost", "admin.localhost"],
  ["127.0.0.1.nip.io", "admin.127.0.0.1.nip.io"],
]);
const LOCAL_ADMIN_HOSTS = new Set(LOCAL_ADMIN_HOST_PAIRS.values());

function splitHost(rawHost?: string | null) {
  const normalizedHost = (rawHost ?? "").trim().toLowerCase();
  const hostWithoutProtocol = normalizedHost.replace(/^https?:\/\//, "");
  const slashIndex = hostWithoutProtocol.indexOf("/");
  const hostPort = slashIndex >= 0 ? hostWithoutProtocol.slice(0, slashIndex) : hostWithoutProtocol;

  if (!hostPort) {
    return { normalizedHost: "", hostname: "", port: null };
  }

  const colonIndex = hostPort.lastIndexOf(":");
  if (colonIndex > -1 && !hostPort.endsWith("]")) {
    return {
      normalizedHost: hostPort,
      hostname: hostPort.slice(0, colonIndex),
      port: hostPort.slice(colonIndex + 1) || null,
    };
  }

  return {
    normalizedHost: hostPort,
    hostname: hostPort,
    port: null,
  };
}

function withPort(hostname: string, port: string | null) {
  return port ? `${hostname}:${port}` : hostname;
}

function getConfiguredAdminHostnames() {
  const rawHosts = process.env[CONFIGURED_ADMIN_HOSTS_ENV] ?? "";

  return new Set(
    rawHosts
      .split(",")
      .map((candidate) => splitHost(candidate).hostname)
      .filter(Boolean),
  );
}

export function getTrustedHostFromHeaders(headers: Pick<Headers, "get"> | { get(name: string): string | null | undefined }) {
  return headers.get("host") ?? null;
}

export function getAdminHostInfo(rawHost?: string | null): HostClassification {
  const { normalizedHost, hostname, port } = splitHost(rawHost);
  const configuredAdminHosts = getConfiguredAdminHostnames();
  const isLocalAdminHost = LOCAL_ADMIN_HOSTS.has(hostname);
  const isPreviewAdminHost = hostname.startsWith("gw-admin.") && hostname.endsWith(".workers.dev");
  const isConfiguredAdminHost = configuredAdminHosts.has(hostname);
  const isAdminHost = isLocalAdminHost || isPreviewAdminHost || isConfiguredAdminHost;

  return {
    rawHost: rawHost ?? "",
    normalizedHost,
    hostname,
    port,
    isAdminHost,
    isConfiguredAdminHost,
    isPreviewAdminHost,
    isLocalAdminHost,
  };
}

export function getAdminHostRedirectHost(rawHost?: string | null) {
  const { hostname, port, isAdminHost } = getAdminHostInfo(rawHost);
  if (!hostname || isAdminHost) {
    return null;
  }

  const localAdminHost = LOCAL_ADMIN_HOST_PAIRS.get(hostname);
  if (localAdminHost) {
    return withPort(localAdminHost, port);
  }

  if (hostname.startsWith("gw-web.") && hostname.endsWith(".workers.dev")) {
    return withPort(hostname.replace(/^gw-web\./, "gw-admin."), port);
  }

  const configuredAdminHost = `admin.${hostname}`;
  if (getConfiguredAdminHostnames().has(configuredAdminHost)) {
    return withPort(configuredAdminHost, port);
  }

  return null;
}
