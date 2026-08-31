/**
 * Eazit Reader - IndexedDB Local File Cache Layer
 * Provides instant local file access and offline reading capabilities.
 */

export const FileCache = {
  DB_NAME: 'eazit_file_cache',
  DB_VERSION: 1,
  STORE: 'files',

  _db: null,

  async open() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.STORE)) {
          db.createObjectStore(this.STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => { this._db = e.target.result; resolve(this._db); };
      req.onerror = (e) => { console.error('[FileCache] open error', e); reject(e); };
    });
  },

  async put(id, name, buffer, meta) {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE, 'readwrite');
        tx.objectStore(this.STORE).put({
          id, name, buffer, meta: meta || '',
          cachedAt: Date.now(),
          size: buffer.byteLength
        });
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e);
      });
    } catch (e) { console.warn('[FileCache] put failed', e); }
  },

  async get(id) {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE, 'readonly');
        const req = tx.objectStore(this.STORE).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = (e) => reject(e);
      });
    } catch (e) { return null; }
  },

  async list() {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE, 'readonly');
        const req = tx.objectStore(this.STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = (e) => reject(e);
      });
    } catch (e) { return []; }
  },

  async delete(id) {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE, 'readwrite');
        tx.objectStore(this.STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e);
      });
    } catch (e) { console.warn('[FileCache] delete failed', e); }
  }
};
