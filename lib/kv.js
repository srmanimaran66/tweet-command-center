// KV abstraction: uses Upstash Redis in production, in-memory Map for local dev.
//
// Supported env var naming conventions (checks both):
//   Upstash marketplace via Vercel: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//   Legacy Vercel KV naming:        KV_REST_API_URL        + KV_REST_API_TOKEN
//
// Set either pair to enable the real store; omit both to use the in-memory fallback.

const _store = new Map();
const _ttls = new Map();

const localKv = {
  async get(key) { return _store.get(key) ?? null; },
  async set(key, value) { _store.set(key, JSON.parse(JSON.stringify(value))); return 'OK'; },
  async setex(key, seconds, value) {
    _store.set(key, JSON.parse(JSON.stringify(value)));
    clearTimeout(_ttls.get(key));
    _ttls.set(key, setTimeout(() => _store.delete(key), seconds * 1000));
    return 'OK';
  },
  async del(...keys) { keys.forEach(k => _store.delete(k)); return keys.length; },
  async keys(pattern) {
    const re = new RegExp(
      '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
    );
    return [..._store.keys()].filter(k => re.test(k));
  },
};

function getUpstashConfig() {
  const url   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

export async function getKv() {
  const config = getUpstashConfig();
  if (config) {
    const { Redis } = await import('@upstash/redis');
    return new Redis(config);
  }
  return localKv;
}
