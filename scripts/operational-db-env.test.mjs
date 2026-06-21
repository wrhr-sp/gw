import test from 'node:test';
import assert from 'node:assert/strict';

import { maskDatabaseUrl, resolveOperationalDbTarget } from './operational-db-env.mjs';

test('preview target prefers DATABASE_URL_PREVIEW', () => {
  const result = resolveOperationalDbTarget(
    {
      DATABASE_URL: 'postgres://explicit-host/groupware',
      DATABASE_URL_PREVIEW: 'postgres://preview-host/groupware-preview',
      DATABASE_URL_PRODUCTION: 'postgres://production-host/groupware-production',
    },
    'preview',
  );

  assert.deepEqual(result, {
    target: 'preview',
    url: 'postgres://preview-host/groupware-preview',
    source: 'DATABASE_URL_PREVIEW',
    usedFallback: false,
    error: null,
  });
});

test('preview target only falls back to DATABASE_URL when explicitly allowed', () => {
  const env = {
    DATABASE_URL: 'postgres://explicit-host/groupware',
  };

  const blocked = resolveOperationalDbTarget(env, 'preview');
  assert.equal(blocked.url, '');
  assert.equal(blocked.source, null);
  assert.match(blocked.error, /DATABASE_URL_PREVIEW/);

  const allowed = resolveOperationalDbTarget(env, 'preview', { allowPreviewFallback: true });
  assert.deepEqual(allowed, {
    target: 'preview',
    url: 'postgres://explicit-host/groupware',
    source: 'DATABASE_URL',
    usedFallback: true,
    error: null,
  });
});

test('production target refuses DATABASE_URL fallback', () => {
  const result = resolveOperationalDbTarget(
    {
      DATABASE_URL: 'postgres://explicit-host/groupware',
    },
    'production',
  );

  assert.equal(result.url, '');
  assert.equal(result.source, null);
  assert.equal(result.usedFallback, false);
  assert.match(result.error, /DATABASE_URL_PRODUCTION/);
  assert.match(result.error, /forbidden/);
});

test('production target uses DATABASE_URL_PRODUCTION when present', () => {
  const result = resolveOperationalDbTarget(
    {
      DATABASE_URL: 'postgres://explicit-host/groupware',
      DATABASE_URL_PRODUCTION: 'postgres://production-host/groupware-production',
    },
    'production',
  );

  assert.deepEqual(result, {
    target: 'production',
    url: 'postgres://production-host/groupware-production',
    source: 'DATABASE_URL_PRODUCTION',
    usedFallback: false,
    error: null,
  });
});

test('maskDatabaseUrl redacts host shape without exposing raw URL', () => {
  assert.equal(
    maskDatabaseUrl('postgresql://preview-host-abcdefghijklmnop.example.com/groupware'),
    'postgresql://prev…le.com/groupware',
  );
});
