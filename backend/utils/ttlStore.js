const mongoose = require('mongoose');
const ttlStoreSchema = new mongoose.Schema({
  namespace: { type: String, required: true },
  key: { type: String, required: true },
  value: { type: String, required: true },
  expiresAt: { type: Date, required: true }
});
ttlStoreSchema.index({ namespace: 1, key: 1 }, { unique: true });
ttlStoreSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const TtlStore = mongoose.models.TtlStore || mongoose.model('TtlStore', ttlStoreSchema);
async function set(namespace, key, value, ttlMs) {
  try {
    const expiresAt = new Date(Date.now() + ttlMs);
    await TtlStore.findOneAndUpdate({ namespace, key }, { namespace, key, value, expiresAt }, { upsert: true, new: true });
  } catch (err) { console.error('[ttlStore] set error:', err.message); }
}
async function get(namespace, key) {
  try {
    const doc = await TtlStore.findOne({ namespace, key });
    if (!doc) return null;
    if (doc.expiresAt < new Date()) { await TtlStore.deleteOne({ namespace, key }); return null; }
    return doc.value;
  } catch (err) { console.error('[ttlStore] get error:', err.message); return null; }
}
async function del(namespace, key) {
  try { await TtlStore.deleteOne({ namespace, key }); } catch (err) { console.error('[ttlStore] del error:', err.message); }
}
async function purgeAll() {
  try { await TtlStore.deleteMany({ expiresAt: { $lt: new Date() } }); } catch (err) { console.error('[ttlStore] purgeAll error:', err.message); }
}
module.exports = { set, get, del, purgeAll };
