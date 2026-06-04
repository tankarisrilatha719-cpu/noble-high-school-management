/**
 * ttlStore.js  —  A simple, file-backed key-value store with TTL expiry.
 *
 * FIX #3: Replaces plain in-memory Maps for CAPTCHA and OTP storage.
 *
 * WHY: In-memory Maps are lost on every server restart, making OTP/CAPTCHA
 *      sessions invalid whenever nodemon reloads or the server crashes.
 *      This implementation persists data to a JSON file so sessions survive
 *      restarts and can be shared across simple multi-process setups.
 *
 * For production at scale, swap this for Redis (ioredis) — the API is
 * intentionally identical so you only need to change this one file.
 */

const fs   = require('fs');
const path = require('path');

const STORE_FILE = path.resolve(__dirname, '../../ttl-store.json');

// ── Helpers ──────────────────────────────────────────────────────────────────

function readStore() {
  try {
    if (!fs.existsSync(STORE_FILE)) return {};
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function writeStore(data) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[ttlStore] Write error:', e.message);
  }
}

// Remove all expired entries and return the cleaned store
function purgeExpired(store) {
  const now = Date.now();
  let changed = false;
  for (const key of Object.keys(store)) {
    if (store[key].expires < now) {
      delete store[key];
      changed = true;
    }
  }
  return { store, changed };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @param {string} namespace  - e.g. 'captcha' or 'otp'
 * @param {string} key
 * @param {any}    value
 * @param {number} ttlMs      - Time-to-live in milliseconds
 */
function set(namespace, key, value, ttlMs) {
  const store = readStore();
  if (!store[namespace]) store[namespace] = {};
  store[namespace][key] = { value, expires: Date.now() + ttlMs };
  writeStore(store);
}

/**
 * Returns the stored value, or null if missing / expired.
 */
function get(namespace, key) {
  const store = readStore();
  const entry = store[namespace] && store[namespace][key];
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    del(namespace, key);          // lazy expiry
    return null;
  }
  return entry.value;
}

/**
 * Deletes a key (e.g. after successful OTP verification).
 */
function del(namespace, key) {
  const store = readStore();
  if (store[namespace]) {
    delete store[namespace][key];
    writeStore(store);
  }
}

/**
 * Call once at startup to remove stale entries accumulated from previous runs.
 */
function purgeAll() {
  const store = readStore();
  for (const ns of Object.keys(store)) {
    const { store: cleaned, changed } = purgeExpired(store[ns] || {});
    if (changed) store[ns] = cleaned;
  }
  writeStore(store);
}

module.exports = { set, get, del, purgeAll };
