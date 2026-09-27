import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signOut,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "onevoice27-f9270.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "onevoice27-f9270",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const FIREBASE_PROJECT_ID = config.projectId;

export const isFirebaseConfigured = Boolean(config.apiKey && config.appId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function getFirebase() {
  if (!isFirebaseConfigured) return null;
  if (!app) {
    app =
      getApps()[0] ||
      initializeApp({
        apiKey: config.apiKey as string,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId as string,
      });
    auth = getAuth(app);
    db = getFirestore(app);
  }
  return { app, auth: auth!, db: db! };
}

function clientOptions() {
  return {
    apiKey: config.apiKey as string,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId as string,
  };
}

/** Creates a Firebase Auth login without signing the clerk out. */
export async function createStaffLogin(email: string, password: string) {
  if (!isFirebaseConfigured) return { ok: true as const, created: false };
  const name = "staffInvite";
  const secondary = getApps().find((item) => item.name === name) || initializeApp(clientOptions(), name);
  const inviteAuth = getAuth(secondary);
  try {
    await createUserWithEmailAndPassword(inviteAuth, email.trim().toLowerCase(), password);
    await signOut(inviteAuth);
    return { ok: true as const, created: true };
  } catch (err) {
    await signOut(inviteAuth).catch(() => undefined);
    const code = typeof err === "object" && err && "code" in err ? String(err.code) : "";
    if (code === "auth/email-already-in-use") return { ok: true as const, created: false };
    if (code === "auth/weak-password") {
      return { ok: false as const, error: "Password must be at least 6 characters." };
    }
    if (code === "auth/invalid-email") return { ok: false as const, error: "That email is not valid." };
    return { ok: false as const, error: "Could not create their sign-in. Check the email and try again." };
  }
}

/** Sends Firebase's reset email. The person must be able to open that inbox. */
export async function sendStaffPasswordReset(email: string) {
  if (!isFirebaseConfigured) {
    return { ok: false as const, error: "Password reset needs the live directory." };
  }
  const fb = getFirebase();
  if (!fb) return { ok: false as const, error: "Firebase is not ready." };
  try {
    await sendPasswordResetEmail(fb.auth, email.trim().toLowerCase());
    return { ok: true as const };
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? String(err.code) : "";
    if (code === "auth/invalid-email") return { ok: false as const, error: "That email is not valid." };
    if (code === "auth/too-many-requests") {
      return { ok: false as const, error: "Too many reset attempts. Wait a few minutes and try again." };
    }
    if (code === "auth/user-not-found") return { ok: true as const };
    return { ok: false as const, error: "Could not send the reset email. Try again." };
  }
}
