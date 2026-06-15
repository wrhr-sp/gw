import { neon } from "@neondatabase/serverless";

export type PostgresEnv = {
  DATABASE_URL?: string;
  DATABASE_URL_PRODUCTION?: string;
  DATABASE_URL_PREVIEW?: string;
  APP_ENV?: string;
};

export type OperationalDbStatus = {
  configured: boolean;
  ok: boolean;
  database: string | null;
  user: string | null;
  schema: string | null;
  error: string | null;
};

export function resolveDatabaseUrl(env: PostgresEnv | undefined) {
  const explicit = env?.DATABASE_URL?.trim();
  if (explicit) {
    return explicit;
  }

  if (env?.APP_ENV === "preview") {
    return env.DATABASE_URL_PREVIEW?.trim() || null;
  }

  return env?.DATABASE_URL_PRODUCTION?.trim() || null;
}

export function createOperationalSql(env: PostgresEnv | undefined) {
  const databaseUrl = resolveDatabaseUrl(env);
  if (!databaseUrl) {
    return null;
  }

  return neon(databaseUrl, {
    fullResults: false,
  });
}

export async function checkOperationalDb(env: PostgresEnv | undefined): Promise<OperationalDbStatus> {
  const sql = createOperationalSql(env);

  if (!sql) {
    return {
      configured: false,
      ok: false,
      database: null,
      user: null,
      schema: null,
      error: "DATABASE_URL is not configured",
    };
  }

  try {
    const rows = await sql`select current_database() as database, current_user as user, current_schema() as schema`;
    const row = rows[0] as { database?: string; user?: string; schema?: string } | undefined;

    return {
      configured: true,
      ok: true,
      database: row?.database ?? null,
      user: row?.user ?? null,
      schema: row?.schema ?? null,
      error: null,
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      database: null,
      user: null,
      schema: null,
      error: error instanceof Error ? error.message : "unknown database error",
    };
  }
}
