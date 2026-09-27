import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { createDemoState } from "./demo-data";
import { getFirebase, isFirebaseConfigured } from "./firebase";
import type {
  AppNotification,
  AppSettings,
  AppState,
  AuditLog,
  Church,
  Member,
  Region,
  UserAccount,
  Visit,
  VisitCategory,
} from "./types";

export function emailDocId(email: string) {
  return email.trim().toLowerCase();
}

function clean<T extends Record<string, unknown>>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out as T;
}

function userToDoc(user: UserAccount) {
  const { password: _password, ...rest } = user;
  return clean(rest as unknown as Record<string, unknown>);
}

async function write(col: string, id: string, data: Record<string, unknown>) {
  const fb = getFirebase();
  if (!fb) return;
  await setDoc(doc(fb.db, col, id), clean(data), { merge: true });
}

export async function liveSetUser(user: UserAccount) {
  await write("users", emailDocId(user.email), userToDoc(user));
}

export async function liveSetChurch(church: Church) {
  await write("churches", church.id, clean(church as unknown as Record<string, unknown>));
}

export async function liveSetMember(member: Member) {
  await write("members", member.id, clean(member as unknown as Record<string, unknown>));
}

export async function liveSetVisit(visit: Visit) {
  await write("visits", visit.id, clean(visit as unknown as Record<string, unknown>));
}

export async function liveSetCategory(category: VisitCategory) {
  await write("categories", category.id, clean(category as unknown as Record<string, unknown>));
}

export async function liveSetNotification(note: AppNotification) {
  await write("notifications", note.id, clean(note as unknown as Record<string, unknown>));
}

export async function liveSetAudit(entry: AuditLog) {
  await write("auditLogs", entry.id, clean(entry as unknown as Record<string, unknown>));
}

export async function liveSetSettings(settings: AppSettings) {
  await write("settings", "global", clean(settings as unknown as Record<string, unknown>));
}

export async function liveSetRegion(region: Region) {
  await write("regions", region.id, clean(region as unknown as Record<string, unknown>));
}

export async function liveDelete(col: string, id: string) {
  const fb = getFirebase();
  if (!fb) return;
  await deleteDoc(doc(fb.db, col, id));
}

async function readAll<T>(col: string): Promise<T[]> {
  const fb = getFirebase();
  if (!fb) return [];
  const snap = await getDocs(collection(fb.db, col));
  return snap.docs.map((d) => d.data() as T);
}

export async function pullLiveState(): Promise<Partial<AppState>> {
  const [users, churches, members, visits, categories, notifications, audit, regions] = await Promise.all([
    readAll<UserAccount>("users"),
    readAll<Church>("churches"),
    readAll<Member>("members"),
    readAll<Visit>("visits"),
    readAll<VisitCategory>("categories"),
    readAll<AppNotification>("notifications"),
    readAll<AuditLog>("auditLogs"),
    readAll<Region>("regions"),
  ]);
  const fb = getFirebase();
  let settings: AppSettings | undefined;
  if (fb) {
    const settingsSnap = await getDoc(doc(fb.db, "settings", "global"));
    if (settingsSnap.exists()) settings = settingsSnap.data() as AppSettings;
  }
  return {
    users,
    churches,
    members,
    visits,
    categories,
    notifications,
    audit: audit.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 400),
    regions: regions.length ? regions : undefined,
    settings,
  };
}

export function subscribeLive(onChange: (patch: Partial<AppState>) => void): Unsubscribe {
  const fb = getFirebase();
  if (!fb) return () => undefined;
  const unsubs = [
    onSnapshot(collection(fb.db, "users"), (snap) =>
      onChange({ users: snap.docs.map((d) => d.data() as UserAccount) }),
    ),
    onSnapshot(collection(fb.db, "churches"), (snap) =>
      onChange({ churches: snap.docs.map((d) => d.data() as Church) }),
    ),
    onSnapshot(collection(fb.db, "members"), (snap) =>
      onChange({ members: snap.docs.map((d) => d.data() as Member) }),
    ),
    onSnapshot(collection(fb.db, "visits"), (snap) =>
      onChange({ visits: snap.docs.map((d) => d.data() as Visit) }),
    ),
    onSnapshot(collection(fb.db, "categories"), (snap) =>
      onChange({ categories: snap.docs.map((d) => d.data() as VisitCategory) }),
    ),
    onSnapshot(collection(fb.db, "notifications"), (snap) =>
      onChange({ notifications: snap.docs.map((d) => d.data() as AppNotification) }),
    ),
    onSnapshot(doc(fb.db, "settings", "global"), (snap) => {
      if (snap.exists()) onChange({ settings: snap.data() as AppSettings });
    }),
  ];
  return () => unsubs.forEach((u) => u());
}

async function writeChunk(col: string, rows: Array<{ id: string; data: Record<string, unknown> }>) {
  const fb = getFirebase();
  if (!fb || !rows.length) return;
  for (let i = 0; i < rows.length; i += 400) {
    const batch = writeBatch(fb.db);
    for (const row of rows.slice(i, i + 400)) {
      batch.set(doc(fb.db, col, row.id), clean(row.data), { merge: true });
    }
    await batch.commit();
  }
}

export async function ensureUserProfile(email: string, fallback?: UserAccount) {
  const fb = getFirebase();
  if (!fb) return fallback ?? null;
  const id = emailDocId(email);
  const ref = doc(fb.db, "users", id);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as UserAccount;
  const seed = createDemoState().users.find((u) => u.email.toLowerCase() === id);
  const profile = fallback || seed;
  if (!profile) return null;
  const next = { ...profile, email: id, status: profile.status || "active" };
  await setDoc(ref, userToDoc(next), { merge: true });
  return next;
}

export async function seedLiveCatalog() {
  if (!isFirebaseConfigured) return { ok: false as const, error: "Firebase is not configured.", churches: 0, users: 0 };
  const fresh = createDemoState();
  const existing = await readAll<Church>("churches");
  const have = new Set(existing.map((c) => c.id));
  const missing = fresh.churches.filter((c) => !have.has(c.id));
  await writeChunk(
    "churches",
    missing.map((c) => ({ id: c.id, data: clean(c as unknown as Record<string, unknown>) })),
  );

  const existingUsers = await readAll<UserAccount>("users");
  const haveUsers = new Set(existingUsers.map((u) => emailDocId(u.email)));
  await writeChunk(
    "users",
    fresh.users
      .filter((u) => !haveUsers.has(emailDocId(u.email)))
      .map((u) => ({ id: emailDocId(u.email), data: userToDoc(u) })),
  );

  const cats = await readAll<VisitCategory>("categories");
  if (!cats.length) {
    await writeChunk(
      "categories",
      fresh.categories.map((c) => ({ id: c.id, data: clean(c as unknown as Record<string, unknown>) })),
    );
  }
  const regions = await readAll<Region>("regions");
  if (!regions.length) {
    await writeChunk(
      "regions",
      fresh.regions.map((r) => ({ id: r.id, data: clean(r as unknown as Record<string, unknown>) })),
    );
  }
  const fb = getFirebase();
  if (fb) {
    const settingsSnap = await getDoc(doc(fb.db, "settings", "global"));
    if (!settingsSnap.exists()) await liveSetSettings(fresh.settings);
  }
  return {
    ok: true as const,
    churches: missing.length,
    users: fresh.users.filter((u) => !haveUsers.has(emailDocId(u.email))).length,
  };
}

export function mergeLive(base: AppState, live: Partial<AppState>): AppState {
  return {
    ...base,
    users: live.users?.length ? live.users : base.users,
    churches: live.churches?.length ? live.churches : base.churches,
    members: live.members ?? base.members,
    visits: live.visits ?? base.visits,
    categories: live.categories?.length ? live.categories : base.categories,
    notifications: live.notifications ?? base.notifications,
    audit: live.audit ?? base.audit,
    regions: live.regions?.length ? live.regions : base.regions,
    settings: live.settings ? { ...base.settings, ...live.settings } : base.settings,
  };
}
