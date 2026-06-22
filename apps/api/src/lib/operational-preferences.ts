import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

type PreferencesRow = {
  preferences: unknown;
  updated_at: string | Date | null;
};

function toIso(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizePreferences(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export async function getOperationalUserPreferences(env: PostgresEnv | undefined, companyId: string, userId: string) {
  const sql = createOperationalSql(env);
  if (!sql) return null;

  try {
    const rows = await sql`
      select preferences, updated_at
      from user_preferences
      where company_id = ${companyId} and user_id = ${userId}
      limit 1
    `;
    const row = rows[0] as PreferencesRow | undefined;
    return {
      preferences: normalizePreferences(row?.preferences),
      updatedAt: toIso(row?.updated_at),
    };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function saveOperationalUserPreferences(
  env: PostgresEnv | undefined,
  companyId: string,
  userId: string,
  preferences: Record<string, unknown>,
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;

  const now = new Date().toISOString();
  const id = `preferences_${companyId}_${userId}`;
  const preferencesJson = JSON.stringify(preferences);

  try {
    const rows = await sql`
      insert into user_preferences (id, company_id, user_id, preferences, created_at, updated_at)
      values (${id}, ${companyId}, ${userId}, ${preferencesJson}::jsonb, ${now}, ${now})
      on conflict (company_id, user_id) do update set
        preferences = user_preferences.preferences || excluded.preferences,
        updated_at = excluded.updated_at
      returning preferences, updated_at
    `;
    const row = rows[0] as PreferencesRow | undefined;
    return {
      preferences: normalizePreferences(row?.preferences),
      updatedAt: toIso(row?.updated_at) ?? now,
    };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}
