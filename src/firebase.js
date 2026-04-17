import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue } from "firebase/database";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

let db = null;
try {
  if (import.meta.env.VITE_FIREBASE_API_KEY) {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
  }
} catch (e) {
  console.warn("Firebase no configurado, usando localStorage.", e);
}

export const firebaseEnabled = !!db;

export async function dbGet(key, def = null) {
  if (!db) return def;
  try {
    const snap = await get(ref(db, key));
    return snap.exists() ? snap.val() : def;
  } catch {
    return def;
  }
}

export async function dbSet(key, value) {
  if (!db) return;
  await set(ref(db, key), value);
}

export function dbSubscribe(key, callback) {
  if (!db) return () => {};
  return onValue(ref(db, key), (snap) => {
    callback(snap.exists() ? snap.val() : null);
  });
}
