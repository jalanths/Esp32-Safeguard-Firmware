/*
 * firebase.js – Firebase Configuration & Initialization
 * ═══════════════════════════════════════════════════════
 *
 * ⚠️ SETUP INSTRUCTIONS TO CONNECT YOUR ESP32 HARDWARE:
 * 1. Go to https://console.firebase.google.com
 * 2. Create a new project (or use existing)
 * 3. Go to Project Settings → General → Your apps → Web app
 * 4. Register a web app and copy your Firebase config
 * 5. Replace the placeholder values below with your real project keys
 * 6. Go to Realtime Database → Create Database → Start in test mode
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, push, set, update, serverTimestamp } from 'firebase/database';

// ═══════════════════════════════════════════════════════════════
// ⚠️ REPLACE THESE VALUES WITH YOUR FIREBASE PROJECT CONFIG
// ═══════════════════════════════════════════════════════════════

export const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "safeguardenvpro.firebaseapp.com",
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://safeguardenvpro-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID || "safeguardenvpro",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "safeguardenvpro.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "16025626179",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID || "1:16025626179:web:fc473195c587ae139f96f6",
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-DLMZSBB11W"
};

// Check if user has entered real Firebase keys or still using placeholders
export const isFirebaseConfigured =
  Boolean(firebaseConfig.apiKey) &&
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  !firebaseConfig.apiKey.includes("YOUR_");

let app = null;
let database = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
  } catch (err) {
    console.error("Firebase initialization error:", err);
  }
}

// Database references helper functions
export const workersRef = (workerId) => (database ? ref(database, `workers/${workerId}/current`) : null);
export const alertsRef  = () => (database ? ref(database, 'alerts') : null);
export const eventsRef  = (workerId) => (database ? ref(database, `workers/${workerId}/events`) : null);

// Export Firebase utilities
export { database, ref, onValue, push, set, update, serverTimestamp };
export default app;
