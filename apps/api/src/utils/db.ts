import { neon } from "@neondatabase/serverless";

export interface Env {
  DATABASE_URL?: string;
  DATABASE_URL_PREVIEW?: string;
  DATABASE_URL_PRODUCTION?: string;
  APP_ENV?: string;
  FILES_BUCKET?: unknown;
  GW_INITIAL_ADMIN_PASSWORD?: string;
  GW_INITIAL_ADMIN_PASSWORD_SALT?: string;
}

export type DatabaseEnv = Pick<Env, "DATABASE_URL" | "DATABASE_URL_PREVIEW" | "DATABASE_URL_PRODUCTION" | "APP_ENV">;
export type SqlClient = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Array<Record<string, any>>>;
  query(text: string, values?: unknown[]): Promise<Array<Record<string, any>>>;
};

export const DATABASE_URL_NOT_CONFIGURED_MESSAGE = "데이터베이스 연결 문자열(DATABASE_URL 계열)이 환경 변수에 정의되지 않았습니다.";

function normalizeConnectionString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Hono Context의 c.env를 기준으로 Cloudflare Workers 런타임 DB 연결 문자열을 해석한다.
 *
 * 우선순위:
 * 1. c.env.DATABASE_URL
 * 2. c.env.APP_ENV === "preview" 인 경우 c.env.DATABASE_URL_PREVIEW
 * 3. 그 외 c.env.DATABASE_URL_PRODUCTION
 */
export function resolveDatabaseUrl(env: DatabaseEnv | undefined) {
  const explicit = normalizeConnectionString(env?.DATABASE_URL);
  if (explicit) return explicit;

  if (env?.APP_ENV === "preview") {
    return normalizeConnectionString(env.DATABASE_URL_PREVIEW) ?? null;
  }

  return normalizeConnectionString(env?.DATABASE_URL_PRODUCTION) ?? null;
}

/**
 * Hono Context 내의 c.env를 기반으로 Neon SQL tagged template client를 반환한다.
 */
export function getDbClient(env: DatabaseEnv): SqlClient {
  const connectionString = resolveDatabaseUrl(env);

  if (!connectionString) {
    throw new Error(DATABASE_URL_NOT_CONFIGURED_MESSAGE);
  }

  return neon(connectionString, {
    fullResults: false,
  }) as SqlClient;
}

/**
 * Health check나 단계적 전환 코드에서만 쓰는 nullable wrapper.
 * 실제 CRUD handler는 getDbClient(c.env)를 사용해 DB 미설정을 명시 오류로 처리한다.
 */
export function createOptionalDbClient(env: DatabaseEnv | undefined): SqlClient | null {
  const connectionString = resolveDatabaseUrl(env);
  if (!connectionString) return null;

  return neon(connectionString, {
    fullResults: false,
  }) as SqlClient;
}
