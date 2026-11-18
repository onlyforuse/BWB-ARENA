import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: 'AIzaSyAJBQZptTeL8GrHtQPSte3LnaYTGPYRHK8',
  authDomain: 'bwb-arena.firebaseapp.com',
  databaseURL: 'https://bwb-arena-default-rtdb.firebaseio.com',
  projectId: 'bwb-arena',
  storageBucket: 'bwb-arena.firebasestorage.app',
  messagingSenderId: '700421259663',
  appId: '1:700421259663:web:9ca8d5e35b1a40ec868bfa',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Ensure persistent sessions across reloads as requested
setPersistence(auth, browserLocalPersistence).catch(() => {});

export const rtdb = getDatabase(app);
export const storage = getStorage(app);

export default app;
