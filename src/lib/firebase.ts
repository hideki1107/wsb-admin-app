import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured: boolean = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId,
);

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;

if (isFirebaseConfigured) {
  _app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  // モバイル/WebView/プロキシ環境でWebSocketが詰まる事象が散見されるため
  // long-polling を強制 (auto-detect だと検出フェーズで20-30秒ハングすることがある)
  _db = initializeFirestore(_app, {
    experimentalForceLongPolling: true,
  });
  _auth = getAuth(_app);
}

const notConfigured = (target: string): never => {
  throw new Error(
    `Firebase is not configured. ${target} cannot be used until .env.local is populated. See README.`,
  );
};

// 設定前は呼び出されると分かりやすいエラーが出る Proxy。
export const db: Firestore = (_db ??
  new Proxy(
    {},
    { get: () => notConfigured("Firestore") },
  )) as Firestore;

export const auth: Auth = (_auth ??
  new Proxy(
    {},
    { get: () => notConfigured("Firebase Auth") },
  )) as Auth;

export const app: FirebaseApp | null = _app;
