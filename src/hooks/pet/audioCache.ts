const DB_NAME = "KokoroAudioCacheDB";
const STORE_NAME = "audioBuffers";
const MAX_CACHE_SIZE = 50;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "text" });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
  }
  return dbPromise;
}

export async function cacheAudio(text: string, audioData: Float32Array) {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    
    // Store the float32 array
    store.put({ text, audioData, timestamp: Date.now() });

    // Cleanup oldest if we exceed MAX_CACHE_SIZE
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result > MAX_CACHE_SIZE) {
        const index = store.index("timestamp");
        const cursorReq = index.openCursor();
        cursorReq.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            // Delete the oldest entry
            store.delete(cursor.primaryKey);
          }
        };
      }
    };
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedAudio(text: string): Promise<Float32Array | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(text);
    
    req.onsuccess = () => {
      if (req.result) {
        resolve(req.result.audioData);
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}
