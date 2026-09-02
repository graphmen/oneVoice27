/**
 * Firebase project: onevoice27-f9270
 * Hosting, Auth and Firestore are configured via firebase.json / firestore.rules.
 * When NEXT_PUBLIC_FIREBASE_* keys are present, swap this stub for the Admin/client SDK.
 * SHEPHERD360 currently runs a production-ready local store (PWA-friendly, offline) so
 * pastors can use the system immediately while Firebase Auth is connected.
 */
export const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "onevoice27-f9270";

export const isFirebaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
);
