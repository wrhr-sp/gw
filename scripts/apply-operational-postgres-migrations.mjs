import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { maskDatabaseUrl, redactDatabaseUrls, resolveOperationalDbTarget } from './operational-db-env.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '../db/postgres/migrations');
const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    allowPreviewFallback: { type: 'boolean', default: false },
    apply: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
  },
});

const target = (positionals[0] || 'preview').toLowerCase();
if (target !== 'preview' && target !== 'production') {
  console.error(`unsupported target: ${target}`);
  process.exit(1);
}


function runPsql(url, args) {
  return spawnSync('psql', [url, ...args], {
    encoding: 'utf8',
    env: process.env,
  });
}

function redactOutput(text) {
  return redactDatabaseUrls(text, databaseTarget.url, process.env.DATABASE_URL);
}

const databaseTarget = resolveOperationalDbTarget(process.env, target, {
  allowPreviewFallback: values.allowPreviewFallback,
});
const databaseUrl = databaseTarget.url;
if (!databaseUrl) {
  console.error(databaseTarget.error);
  process.exit(1);
}

if (!values.apply) {
  const status = runPsql(databaseUrl, [
    '-At',
    '-c',
    "select current_database() || '|' || current_user || '|' || current_schema()",
  ]);

  if (status.status !== 0) {
    console.error(redactOutput(status.stderr || status.stdout || 'psql status check failed'));
    process.exit(status.status ?? 1);
  }

  const [database = '', user = '', schema = ''] = (status.stdout || '').trim().split('|');
  const payload = {
    target,
    database_url: maskDatabaseUrl(databaseUrl),
    source_env: databaseTarget.source,
    preview_fallback: databaseTarget.usedFallback,
    connection: {
      database: database || null,
      user: user || null,
      schema: schema || null,
    },
    migrations: migrationFiles,
    will_apply: false,
  };

  if (values.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`target=${payload.target}`);
    console.log(`database=${payload.database_url}`);
    console.log(`source_env=${payload.source_env}`);
    console.log(`preview_fallback=${payload.preview_fallback}`);
    console.log(`connection=${payload.connection.database}/${payload.connection.schema} as ${payload.connection.user}`);
    console.log(`migrations=${payload.migrations.join(', ')}`);
    console.log('will_apply=false');
  }
  process.exit(0);
}

const applied = [];
for (const fileName of migrationFiles) {
  const fullPath = join(migrationsDir, fileName);
  const result = runPsql(databaseUrl, ['-v', 'ON_ERROR_STOP=1', '-f', fullPath]);
  if (result.status !== 0) {
    console.error(redactOutput(result.stderr || result.stdout || `failed to apply ${fileName}`));
    process.exit(result.status ?? 1);
  }
  applied.push(fileName);
}

const payload = {
  target,
  database_url: maskDatabaseUrl(databaseUrl),
  source_env: databaseTarget.source,
  preview_fallback: databaseTarget.usedFallback,
  applied,
  count: applied.length,
};

if (values.json) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log(`applied=${applied.length}`);
  console.log(`target=${target}`);
  console.log(`database=${payload.database_url}`);
  console.log(`source_env=${payload.source_env}`);
  console.log(`preview_fallback=${payload.preview_fallback}`);
  console.log(`files=${applied.join(', ')}`);
}
