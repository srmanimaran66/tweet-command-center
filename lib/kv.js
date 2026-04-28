// KV abstraction: uses Vercel KV in production, in-memory Map for local dev.
// Set KV_REST_API_URL + KV_REST_API_TOKEN to enable the real store.

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

export async function getKv() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { kv } = await import('@vercel/kv');
    return kv;
  }
  return localKv;
}
