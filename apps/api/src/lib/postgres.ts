import {
  DATABASE_URL_NOT_CONFIGURED_MESSAGE,
  createOptionalDbClient,
  resolveDatabaseUrl,
  type DatabaseEnv,
} from "../utils/db";

export type PostgresEnv = DatabaseEnv;
export { resolveDatabaseUrl };

export type OperationalDbStatus = {
  configured: boolean;
  ok: boolean;
  database: string | null;
  user: string | null;
  schema: string | null;
  error: string | null;
};

export function createOperationalSql(env: PostgresEnv | undefined) {
  return createOptionalDbClient(env);
}

export function isOperationalSchemaDriftError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? (error as { code?: unknown }).code : undefined;
  if (code === "42P01" || code === "42703" || code === "3F000") {
    return true;
  }

  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /(relation|column|schema) .* does not exist|undefined table|undefined column|schema mismatch/i.test(message);
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
      error: DATABASE_URL_NOT_CONFIGURED_MESSAGE,
    };
  }

  try {
    const rows = (await sql`select current_database() as database, current_user as user, current_schema() as schema`) as Array<{
      database?: string;
      user?: string;
      schema?: string;
    }>;
    const row = rows[0];

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
