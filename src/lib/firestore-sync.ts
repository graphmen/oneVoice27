import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
  type QueryConstraint,
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

async function safeRead<T>(label: string, task: () => Promise<T[]>): Promise<T[] | undefined> {
  try {
    return await task();
  } catch (err) {
    console.warn(`SHEPHERD360 live read ${label}`, err);
    return undefined;
  }
}

function chunkIds(ids: string[], size = 10) {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

function uniqueByKey<T extends { id?: string; email?: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = row.id || row.email;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function readQuery<T>(col: string, ...constraints: QueryConstraint[]): Promise<T[]> {
  const fb = getFirebase();
  if (!fb) return [];
  const snap = await getDocs(query(collection(fb.db, col), ...constraints));
  return snap.docs.map((d) => d.data() as T);
}

async function readIn<T extends { id?: string; email?: string }>(col: string, field: string, values: string[]) {
  if (!values.length) return [] as T[];
  const parts = await Promise.all(chunkIds(values).map((ids) => readQuery<T>(col, where(field, "in", ids))));
  return uniqueByKey(parts.flat());
}

async function readContainsAny<T extends { id?: string; email?: string }>(
  col: string,
  field: string,
  values: string[],
) {
  if (!values.length) return [] as T[];
  const parts = await Promise.all(
    chunkIds(values).map((ids) => readQuery<T>(col, where(field, "array-contains-any", ids))),
  );
  return uniqueByKey(parts.flat());
}

async function readOwnUser(viewer: UserAccount): Promise<UserAccount[]> {
  const fb = getFirebase();
  if (!fb) return [viewer];
  const snap = await getDoc(doc(fb.db, "users", emailDocId(viewer.email)));
  return snap.exists() ? [snap.data() as UserAccount] : [viewer];
}

export async function pullLiveState(viewer?: UserAccount | null): Promise<Partial<AppState>> {
  const fb = getFirebase();
  const churchIds = viewer?.churchIds || [];
  const [churches, categories, regions] = await Promise.all([
    safeRead<Church>("churches", () => readAll("churches")),
    safeRead<VisitCategory>("categories", () => readAll("categories")),
    safeRead<Region>("regions", () => readAll("regions")),
  ]);

  let users: UserAccount[] | undefined;
  let members: Member[] | undefined;
  let visits: Visit[] | undefined;
  let notifications: AppNotification[] | undefined;
  let audit: AuditLog[] | undefined;

  if (!viewer || viewer.role === "master_admin") {
    users = await safeRead("users", () => readAll<UserAccount>("users"));
    members = await safeRead("members", () => readAll<Member>("members"));
    visits = await safeRead("visits", () => readAll<Visit>("visits"));
    audit = await safeRead("auditLogs", () => readAll<AuditLog>("auditLogs"));
  } else if (viewer.role === "church_admin") {
    const [own, shared] = await Promise.all([
      readOwnUser(viewer),
      safeRead("users", () => readContainsAny<UserAccount>("users", "churchIds", churchIds)),
    ]);
    users = uniqueByKey([...own, ...(shared || [])]);
    members = await safeRead("members", () => readIn<Member>("members", "churchId", churchIds));
    visits = await safeRead("visits", () => readIn<Visit>("visits", "churchId", churchIds));
  } else {
    const [own, shared] = await Promise.all([
      readOwnUser(viewer),
      safeRead("users", () => readContainsAny<UserAccount>("users", "churchIds", churchIds)),
    ]);
    users = uniqueByKey([...own, ...(shared || [])]);
    members = await safeRead("members", () =>
      readQuery<Member>("members", where("assignedPastorId", "==", viewer.id)),
    );
    visits = await safeRead("visits", () => readQuery<Visit>("visits", where("pastorId", "==", viewer.id)));
  }

  if (viewer) {
    notifications = await safeRead("notifications", () =>
      readQuery<AppNotification>("notifications", where("userId", "==", viewer.id)),
    );
  }

  let settings: AppSettings | undefined;
  if (fb) {
    try {
      const settingsSnap = await getDoc(doc(fb.db, "settings", "global"));
      if (settingsSnap.exists()) settings = settingsSnap.data() as AppSettings;
    } catch (err) {
      console.warn("SHEPHERD360 live read settings", err);
    }
  }

  return {
    users,
    churches,
    members,
    visits,
    categories,
    notifications,
    audit: audit?.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 400),
    regions: regions?.length ? regions : undefined,
    settings,
  };
}

function listenQuery<T>(
  col: string,
  onRows: (rows: T[]) => void,
  ...constraints: QueryConstraint[]
): Unsubscribe {
  const fb = getFirebase();
  if (!fb) return () => undefined;
  const source = constraints.length
    ? query(collection(fb.db, col), ...constraints)
    : collection(fb.db, col);
  return onSnapshot(
    source,
    (snap) => onRows(snap.docs.map((d) => d.data() as T)),
    (err) => console.warn(`SHEPHERD360 live ${col}`, err),
  );
}

function listenChunks<T extends { id?: string; email?: string }>(
  col: string,
  field: string,
  values: string[],
  op: "in" | "array-contains-any",
  onRows: (rows: T[]) => void,
): Unsubscribe {
  if (!values.length) {
    onRows([]);
    return () => undefined;
  }
  const groups = chunkIds(values);
  const buckets: T[][] = groups.map(() => []);
  const unsubs = groups.map((ids, index) =>
    listenQuery<T>(
      col,
      (rows) => {
        buckets[index] = rows;
        onRows(uniqueByKey(buckets.flat()));
      },
      where(field, op, ids),
    ),
  );
  return () => unsubs.forEach((unsub) => unsub());
}

export function subscribeLive(viewer: UserAccount, onChange: (patch: Partial<AppState>) => void): Unsubscribe {
  const fb = getFirebase();
  if (!fb) return () => undefined;
  const churchIds = viewer.churchIds || [];
  const unsubs: Unsubscribe[] = [
    listenQuery<Church>("churches", (churches) => onChange({ churches })),
    listenQuery<VisitCategory>("categories", (categories) => onChange({ categories })),
    onSnapshot(
      doc(fb.db, "settings", "global"),
      (snap) => {
        if (snap.exists()) onChange({ settings: snap.data() as AppSettings });
      },
      (err) => console.warn("SHEPHERD360 live settings", err),
    ),
    listenQuery<AppNotification>(
      "notifications",
      (notifications) => onChange({ notifications }),
      where("userId", "==", viewer.id),
    ),
  ];

  if (viewer.role === "master_admin") {
    unsubs.push(
      listenQuery<UserAccount>("users", (users) => onChange({ users })),
      listenQuery<Member>("members", (members) => onChange({ members })),
      listenQuery<Visit>("visits", (visits) => onChange({ visits })),
    );
  } else if (viewer.role === "church_admin") {
    unsubs.push(
      listenChunks<UserAccount>("users", "churchIds", churchIds, "array-contains-any", (users) =>
        onChange({ users: uniqueByKey([viewer, ...users]) }),
      ),
      listenChunks<Member>("members", "churchId", churchIds, "in", (members) => onChange({ members })),
      listenChunks<Visit>("visits", "churchId", churchIds, "in", (visits) => onChange({ visits })),
    );
  } else {
    unsubs.push(
      listenChunks<UserAccount>("users", "churchIds", churchIds, "array-contains-any", (users) =>
        onChange({ users: uniqueByKey([viewer, ...users]) }),
      ),
      listenQuery<Member>("members", (members) => onChange({ members }), where("assignedPastorId", "==", viewer.id)),
      listenQuery<Visit>("visits", (visits) => onChange({ visits }), where("pastorId", "==", viewer.id)),
    );
  }

  return () => unsubs.forEach((unsub) => unsub());
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
