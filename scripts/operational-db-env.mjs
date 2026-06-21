export function normalizeTarget(target) {
  return target === 'production' ? 'production' : 'preview';
}

export function resolveOperationalDbTarget(env = process.env, targetInput = 'preview', options = {}) {
  const target = normalizeTarget(targetInput);
  const allowPreviewFallback = options.allowPreviewFallback === true;

  if (target === 'preview') {
    const previewUrl = env.DATABASE_URL_PREVIEW?.trim();
    if (previewUrl) {
      return {
        target,
        url: previewUrl,
        source: 'DATABASE_URL_PREVIEW',
        usedFallback: false,
        error: null,
      };
    }

    const explicitUrl = env.DATABASE_URL?.trim();
    if (allowPreviewFallback && explicitUrl) {
      return {
        target,
        url: explicitUrl,
        source: 'DATABASE_URL',
        usedFallback: true,
        error: null,
      };
    }

    return {
      target,
      url: '',
      source: null,
      usedFallback: false,
      error: allowPreviewFallback
        ? 'DATABASE_URL_PREVIEW or DATABASE_URL is not set'
        : 'DATABASE_URL_PREVIEW is not set (manual preview/local fallback requires --allow-preview-fallback and DATABASE_URL)',
    };
  }

  const productionUrl = env.DATABASE_URL_PRODUCTION?.trim();
  if (productionUrl) {
    return {
      target,
      url: productionUrl,
      source: 'DATABASE_URL_PRODUCTION',
      usedFallback: false,
      error: null,
    };
  }

  return {
    target,
    url: '',
    source: null,
    usedFallback: false,
    error: 'DATABASE_URL_PRODUCTION is required for production target; DATABASE_URL fallback is forbidden',
  };
}

export function maskDatabaseUrl(rawUrl) {
  if (!rawUrl) {
    return 'DATABASE_URL 없음';
  }

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname || 'unknown';
    const maskedHost = host.length > 12 ? `${host.slice(0, 4)}…${host.slice(-6)}` : host;
    const database = parsed.pathname.replace(/^\//, '') || 'unknown';
    return `${parsed.protocol.replace(/:$/, '')}://${maskedHost}/${database}`;
  } catch {
    return '[REDACTED_URL]';
  }
}

export function redactDatabaseUrls(text, ...rawUrls) {
  let redacted = text;
  for (const rawUrl of rawUrls) {
    if (rawUrl) {
      redacted = redacted.split(rawUrl).join('[REDACTED_URL]');
    }
  }
  return redacted.replace(/postgres(?:ql)?:\/\/\S+/g, '[REDACTED_URL]');
}
