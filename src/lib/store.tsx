"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { SESSION_KEY, STATE_KEY, GIS_DATASET } from "./constants";
import { createDemoState } from "./demo-data";
import { getFirebase, isFirebaseConfigured } from "./firebase";
import {
  ensureUserProfile,
  liveDelete,
  liveSetAudit,
  liveSetCategory,
  liveSetChurch,
  liveSetMember,
  liveSetNotification,
  liveSetSettings,
  liveSetUser,
  liveSetVisit,
  mergeLive,
  pullLiveState,
  seedLiveCatalog as seedLiveCatalogRemote,
  subscribeLive,
} from "./firestore-sync";
import { attachOfficialGeometries, stripOfficialGeometry } from "./official-boundaries";
import { remapLegacyTerritoryId, LEGACY_TERRITORY_IDS } from "./territory-seed";
import type {
  AppNotification,
  AppState,
  Church,
  Member,
  Territory,
  UserAccount,
  Visit,
  VisitCategory,
} from "./types";
import { computeNextDue, formatLongDate, fullName, uid } from "./utils";

type StoreContextValue = {
  ready: boolean;
  live: boolean;
  user: UserAccount | null;
  state: AppState;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  importMembers: (members: Member[]) => { added: number };
  seedLiveCatalog: () => Promise<{ ok: boolean; error?: string; churches?: number }>;
  upsertMember: (member: Member) => void;
  deleteMember: (id: string) => void;
  upsertUser: (account: UserAccount) => void;
  deleteUser: (id: string) => void;
  upsertChurch: (church: Church) => void;
  deleteChurch: (id: string) => void;
  upsertTerritory: (territory: Territory) => void;
  deleteTerritory: (id: string) => void;
  upsertCategory: (category: VisitCategory) => void;
  recordVisit: (visit: Visit) => void;
  scheduleVisit: (memberId: string, scheduledAt: string, pastorId: string) => void;
  cancelScheduledVisit: (memberId: string) => void;
  reviewException: (visitId: string, approve: boolean, reviewerId: string) => void;
  markNotificationRead: (id: string) => void;
  updateSettings: (patch: Partial<AppState["settings"]>) => void;
  resetDemo: () => void;
  log: (action: string, entityType: string, entityId: string, metadata?: Record<string, unknown>) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

function liveWrite(task: () => Promise<void>) {
  if (!isFirebaseConfigured) return;
  task().catch((err) => console.error("SHEPHERD360 sync", err));
}

function migrateState(parsed: AppState, fresh: AppState): AppState {
  const churches: Church[] = (parsed.churches || []).map((c) => {
    const seed = fresh.churches.find((f) => f.id === c.id);
    return {
      ...seed,
      ...c,
      districtId: remapLegacyTerritoryId(c.districtId || seed?.districtId),
      territoryId: remapLegacyTerritoryId(c.territoryId || seed?.territoryId),
    };
  });
  const seenChurches = new Set(churches.map((c) => c.id));
  for (const seed of fresh.churches) {
    if (!seenChurches.has(seed.id)) churches.push(seed);
  }
  const users = (parsed.users || []).map((u) => {
    const seed = fresh.users.find((f) => f.id === u.id);
    const sourceIds = u.territoryIds?.length ? u.territoryIds : seed?.territoryIds;
    return {
      ...seed,
      ...u,
      territoryIds: sourceIds?.map((id) => remapLegacyTerritoryId(id) || id),
    };
  });

  const dummy = new Set(Object.keys(LEGACY_TERRITORY_IDS));
  const needsGisUpgrade =
    parsed.settings?.gisDataset !== GIS_DATASET ||
    !parsed.territories?.some((t) => t.officialSource) ||
    parsed.territories.some((t) => dummy.has(t.id));

  let territories: Territory[];
  if (needsGisUpgrade) {
    const custom = (parsed.territories || []).filter(
      (t) => !dummy.has(t.id) && !t.officialSource && !fresh.territories.some((seed) => seed.id === t.id),
    );
    territories = [...fresh.territories, ...custom];
  } else {
    const bySeed = new Map(fresh.territories.map((t) => [t.id, t]));
    const seen = new Set<string>();
    territories = (parsed.territories || []).map((t) => {
      seen.add(t.id);
      const seed = bySeed.get(t.id);
      if (!seed) return { ...t, parentId: remapLegacyTerritoryId(t.parentId) };
      return {
        ...seed,
        ...t,
        officialSource: seed.officialSource,
        sourceFeatureIndex: seed.sourceFeatureIndex,
        pin: t.pin || seed.pin,
        geometry: t.geometryOverride ? t.geometry : undefined,
        assignedPastorIds: t.assignedPastorIds?.length ? t.assignedPastorIds : seed.assignedPastorIds,
      };
    });
    for (const seed of fresh.territories) {
      if (!seen.has(seed.id)) territories.push(seed);
    }
  }

  const conferenceName =
    parsed.settings?.conferenceName === "Zimbabwe East Conference"
      ? "East Zimbabwe Conference"
      : parsed.settings?.conferenceName || fresh.settings.conferenceName;

  const visits = (parsed.visits || fresh.visits).map((v) => {
    const seed = fresh.visits.find((f) => f.id === v.id);
    if (!seed) return v;
    return {
      ...seed,
      ...v,
      prayed: v.prayed ?? seed.prayed,
      bibleStudy: v.bibleStudy ?? seed.bibleStudy,
      baptismInterest: v.baptismInterest ?? seed.baptismInterest,
      decisionMade: v.decisionMade ?? seed.decisionMade,
      referred: v.referred ?? seed.referred,
    };
  });
  const seenVisits = new Set(visits.map((v) => v.id));
  for (const seed of fresh.visits) {
    if (!seenVisits.has(seed.id)) visits.push(seed);
  }

  return {
    ...fresh,
    ...parsed,
    churches: churches.length ? churches : fresh.churches,
    users: users.length ? users : fresh.users,
    territories,
    visits,
    settings: {
      ...fresh.settings,
      ...parsed.settings,
      conferenceName,
      gisDataset: GIS_DATASET,
    },
  };
}

function loadState(): AppState {
  const fresh = createDemoState();
  if (typeof window === "undefined") return fresh;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed.members || !parsed.users) return fresh;
    return migrateState(parsed, fresh);
  } catch {
    return fresh;
  }
}

function loadUser(users: UserAccount[]): UserAccount | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem(SESSION_KEY);
  return users.find((u) => u.id === id && u.status === "active") ?? null;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(createDemoState);
  const [user, setUser] = useState<UserAccount | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cached = loadState();
    setState(cached);
    attachOfficialGeometries(cached.territories)
      .then((territories) => {
        if (!cancelled) setState((s) => ({ ...s, territories }));
      })
      .catch(() => undefined);

    if (!isFirebaseConfigured) {
      setUser(loadUser(cached.users));
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    const fb = getFirebase();
    if (!fb) {
      setUser(loadUser(cached.users));
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    const unsub = onAuthStateChanged(fb.auth, async (fbUser) => {
      try {
        if (!fbUser?.email) {
          if (!cancelled) {
            setUser(null);
            setReady(true);
          }
          return;
        }
        const profile = await ensureUserProfile(fbUser.email);
        if (profile?.role === "master_admin") await seedLiveCatalogRemote();
        const pulled = await pullLiveState();
        if (cancelled) return;
        setState((s) => mergeLive(s, pulled));
        if (profile && profile.status === "active") {
          setUser(profile);
          localStorage.setItem(SESSION_KEY, profile.id);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("SHEPHERD360 live hydrate", err);
        if (!cancelled) setUser(loadUser(cached.users));
      } finally {
        if (!cancelled) setReady(true);
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!ready || !isFirebaseConfigured || !user) return;
    return subscribeLive((patch) => {
      setState((s) => ({
        ...s,
        ...patch,
        settings: patch.settings ? { ...s.settings, ...patch.settings } : s.settings,
        territories: s.territories,
      }));
    });
  }, [ready, user]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify({
        ...state,
        territories: stripOfficialGeometry(state.territories),
      }),
    );
  }, [state, ready]);

  const persistUser = (account: UserAccount | null) => {
    setUser(account);
    if (account) localStorage.setItem(SESSION_KEY, account.id);
    else localStorage.removeItem(SESSION_KEY);
  };

  const login = useCallback(
    async (email: string, password: string) => {
      const normalized = email.trim().toLowerCase();
      const directory =
        state.users.find((u) => u.email.toLowerCase() === normalized && u.status === "active") ||
        createDemoState().users.find((u) => u.email.toLowerCase() === normalized && u.status === "active");

      if (!isFirebaseConfigured) {
        if (!directory || directory.password !== password) {
          return { ok: false, error: "Invalid email or password." };
        }
        persistUser(directory);
        return { ok: true };
      }

      const fb = getFirebase();
      if (!fb) return { ok: false, error: "Firebase is not ready." };
      try {
        await signInWithEmailAndPassword(fb.auth, normalized, password);
      } catch {
        if (!directory || directory.password !== password) {
          return { ok: false, error: "Invalid email or password." };
        }
        try {
          await createUserWithEmailAndPassword(fb.auth, normalized, password);
        } catch (err) {
          const code = typeof err === "object" && err && "code" in err ? String(err.code) : "";
          if (code === "auth/email-already-in-use") {
            return { ok: false, error: "Invalid email or password." };
          }
          return { ok: false, error: "Unable to sign in with the live directory." };
        }
      }
      const profile = await ensureUserProfile(normalized, directory);
      if (!profile || profile.status !== "active") {
        return { ok: false, error: "Account is not active." };
      }
      persistUser(profile);
      return { ok: true };
    },
    [state.users],
  );

  const logout = useCallback(() => {
    const fb = getFirebase();
    if (fb) signOut(fb.auth).catch(() => undefined);
    persistUser(null);
  }, []);

  const log = useCallback(
    (action: string, entityType: string, entityId: string, metadata?: Record<string, unknown>) => {
      if (!user) return;
      const entry = {
        id: uid("aud"),
        actorId: user.id,
        actorName: user.displayName,
        action,
        entityType,
        entityId,
        metadata,
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({ ...s, audit: [entry, ...s.audit].slice(0, 400) }));
      liveWrite(async () => {
        await liveSetAudit(entry);
      });
    },
    [user],
  );

  const upsertMember = useCallback(
    (member: Member) => {
      setState((s) => ({
        ...s,
        members: s.members.some((m) => m.id === member.id)
          ? s.members.map((m) => (m.id === member.id ? member : m))
          : [member, ...s.members],
      }));
      liveWrite(async () => {
        await liveSetMember(member);
      });
      log("member.upsert", "member", member.id, { name: `${member.firstName} ${member.lastName}` });
    },
    [log],
  );

  const deleteMember = useCallback(
    (id: string) => {
      setState((s) => ({
        ...s,
        members: s.members.filter((m) => m.id !== id),
        visits: s.visits.filter((v) => v.memberId !== id),
        notifications: s.notifications.filter((n) => n.href !== `/members/${id}` && n.href !== `/go/${id}`),
      }));
      liveWrite(async () => {
        await liveDelete("members", id);
      });
      log("member.delete", "member", id);
    },
    [log],
  );

  const upsertUser = useCallback(
    (account: UserAccount) => {
      setState((s) => ({
        ...s,
        users: s.users.some((u) => u.id === account.id)
          ? s.users.map((u) => (u.id === account.id ? account : u))
          : [account, ...s.users],
      }));
      setUser((cur) => (cur?.id === account.id ? account : cur));
      liveWrite(async () => {
        await liveSetUser(account);
      });
      log("user.upsert", "user", account.id, { role: account.role });
    },
    [log],
  );

  const deleteUser = useCallback(
    (id: string) => {
      setState((s) => ({
        ...s,
        users: s.users.filter((u) => u.id !== id),
        members: s.members.map((m) => (m.assignedPastorId === id ? { ...m, assignedPastorId: undefined } : m)),
        territories: s.territories.map((t) => ({
          ...t,
          assignedPastorIds: t.assignedPastorIds.filter((pid) => pid !== id),
        })),
      }));
      liveWrite(async () => {
        const account = state.users.find((u) => u.id === id);
        if (account) await liveDelete("users", account.email.toLowerCase());
      });
      log("user.delete", "user", id);
    },
    [log, state.users],
  );

  const upsertChurch = useCallback(
    (church: Church) => {
      setState((s) => ({
        ...s,
        churches: s.churches.some((c) => c.id === church.id)
          ? s.churches.map((c) => (c.id === church.id ? church : c))
          : [church, ...s.churches],
      }));
      liveWrite(async () => {
        await liveSetChurch(church);
      });
      log("church.upsert", "church", church.id);
    },
    [log],
  );

  const deleteChurch = useCallback(
    (id: string) => {
      setState((s) => {
        const memberIds = new Set(s.members.filter((m) => m.churchId === id).map((m) => m.id));
        return {
          ...s,
          churches: s.churches.filter((c) => c.id !== id),
          members: s.members.filter((m) => m.churchId !== id),
          visits: s.visits.filter((v) => v.churchId !== id && !memberIds.has(v.memberId)),
          users: s.users.map((u) => ({ ...u, churchIds: u.churchIds.filter((cid) => cid !== id) })),
          territories: s.territories.map((t) => (t.churchId === id ? { ...t, churchId: undefined } : t)),
          notifications: s.notifications.filter(
            (n) => ![...memberIds].some((mid) => n.href?.includes(mid)),
          ),
        };
      });
      setUser((cur) => (cur ? { ...cur, churchIds: cur.churchIds.filter((cid) => cid !== id) } : cur));
      liveWrite(async () => {
        await liveDelete("churches", id);
      });
      log("church.delete", "church", id);
    },
    [log],
  );

  const upsertTerritory = useCallback(
    (territory: Territory) => {
      setState((s) => ({
        ...s,
        territories: s.territories.some((t) => t.id === territory.id)
          ? s.territories.map((t) => (t.id === territory.id ? territory : t))
          : [...s.territories, territory],
      }));
      log("territory.upsert", "territory", territory.id, { level: territory.level, name: territory.name });
    },
    [log],
  );

  const deleteTerritory = useCallback(
    (id: string) => {
      setState((s) => ({
        ...s,
        territories: s.territories.filter((t) => t.id !== id && t.parentId !== id),
      }));
      log("territory.delete", "territory", id);
    },
    [log],
  );

  const upsertCategory = useCallback(
    (category: VisitCategory) => {
      setState((s) => ({
        ...s,
        categories: s.categories.some((c) => c.id === category.id)
          ? s.categories.map((c) => (c.id === category.id ? category : c))
          : [...s.categories, category],
      }));
      liveWrite(async () => {
        await liveSetCategory(category);
      });
      log("category.upsert", "category", category.id);
    },
    [log],
  );

  const recordVisit = useCallback(
    (visit: Visit) => {
      setState((s) => {
        const done = visit.status === "completed" || visit.status === "exception_approved";
        const happened = done || visit.status === "exception_pending";
        let visits = s.visits.some((v) => v.id === visit.id)
          ? s.visits.map((v) => (v.id === visit.id ? visit : v))
          : [visit, ...s.visits];
        if (happened) {
          visits = visits.filter(
            (v) =>
              !(
                v.id !== visit.id &&
                v.memberId === visit.memberId &&
                v.pastorId === visit.pastorId &&
                v.status === "scheduled"
              ),
          );
        }
        const members = happened
          ? s.members.map((m) =>
              m.id === visit.memberId
                ? {
                    ...m,
                    scheduledVisitAt: undefined,
                    ...(done
                      ? {
                          lastVisitAt: visit.completedAt,
                          nextVisitDue: computeNextDue(
                            visit.completedAt,
                            m.visitationFrequency,
                            m.customFrequencyDays,
                          ),
                          memberType: m.memberType === "crisis" ? "regular" : m.memberType,
                        }
                      : {}),
                  }
                : m,
            )
          : s.members;
        const note: AppNotification = {
          id: uid("nt"),
          userId: visit.pastorId,
          title:
            visit.status === "completed"
              ? "Visitation recorded"
              : visit.status === "exception_pending"
                ? "Exception submitted"
                : "Visit updated",
          body: "The pastoral care record has been saved.",
          type: visit.status === "exception_pending" ? "exception" : "system",
          read: false,
          createdAt: new Date().toISOString(),
          href: `/visits/${visit.id}`,
        };
        const updatedMember = members.find((m) => m.id === visit.memberId);
        const dropped = s.visits.filter(
          (v) =>
            happened &&
            v.id !== visit.id &&
            v.memberId === visit.memberId &&
            v.pastorId === visit.pastorId &&
            v.status === "scheduled",
        );
        liveWrite(async () => {
          await liveSetVisit(visit);
          if (updatedMember) await liveSetMember(updatedMember);
          await liveSetNotification(note);
          for (const old of dropped) await liveDelete("visits", old.id);
        });
        return { ...s, visits, members, notifications: [note, ...s.notifications] };
      });
      log(
        visit.status === "exception_pending" ? "visit.exception_requested" : "visit.recorded",
        "visit",
        visit.id,
        { status: visit.status, verification: visit.locationVerification },
      );
    },
    [log],
  );

  const scheduleVisit = useCallback(
    (memberId: string, scheduledAt: string, pastorId: string) => {
      setState((s) => {
        const member = s.members.find((m) => m.id === memberId);
        if (!member) return s;
        const existing = s.visits.find(
          (v) => v.memberId === memberId && v.pastorId === pastorId && v.status === "scheduled",
        );
        const visit: Visit = {
          id: existing?.id || uid("vis"),
          memberId,
          pastorId,
          churchId: member.churchId,
          categoryId: existing?.categoryId || "cat_pastoral",
          status: "scheduled",
          scheduledAt,
          locationVerification: "unverified",
          geofenceStatus: "unknown",
          followUpRequired: false,
          referralRequired: false,
          createdAt: existing?.createdAt || new Date().toISOString(),
        };
        const visits = existing
          ? s.visits.map((v) => (v.id === existing.id ? visit : v))
          : [visit, ...s.visits];
        const members = s.members.map((m) => (m.id === memberId ? { ...m, scheduledVisitAt: scheduledAt } : m));
        const note: AppNotification = {
          id: uid("nt"),
          userId: pastorId,
          title: "Visit booked",
          body: `You booked ${fullName(member)} on ${formatLongDate(scheduledAt)}. Tell the household on WhatsApp or SMS — they do not have this app.`,
          type: "reminder",
          read: false,
          createdAt: new Date().toISOString(),
          href: `/members/${memberId}`,
        };
        liveWrite(async () => {
          await liveSetVisit(visit);
          const booked = members.find((m) => m.id === memberId);
          if (booked) await liveSetMember(booked);
          await liveSetNotification(note);
        });
        return { ...s, visits, members, notifications: [note, ...s.notifications] };
      });
      log("visit.scheduled", "member", memberId, { scheduledAt, pastorId });
    },
    [log],
  );

  const cancelScheduledVisit = useCallback(
    (memberId: string) => {
      setState((s) => {
        const dropped = s.visits.filter((v) => v.memberId === memberId && v.status === "scheduled");
        const members = s.members.map((m) => (m.id === memberId ? { ...m, scheduledVisitAt: undefined } : m));
        liveWrite(async () => {
          const member = members.find((m) => m.id === memberId);
          if (member) await liveSetMember(member);
          for (const visit of dropped) await liveDelete("visits", visit.id);
        });
        return {
          ...s,
          members,
          visits: s.visits.filter((v) => !(v.memberId === memberId && v.status === "scheduled")),
        };
      });
      log("visit.schedule_cancelled", "member", memberId);
    },
    [log],
  );

  const reviewException = useCallback(
    (visitId: string, approve: boolean, reviewerId: string) => {
      setState((s) => {
        const visit = s.visits.find((v) => v.id === visitId);
        if (!visit) return s;
        const next: Visit = {
          ...visit,
          status: approve ? "exception_approved" : "exception_rejected",
          locationVerification: approve ? "manual" : visit.locationVerification,
          exceptionApprovedBy: reviewerId,
          exceptionReviewedAt: new Date().toISOString(),
        };
        const visits = s.visits.map((v) => (v.id === visitId ? next : v));
        const members = approve
          ? s.members.map((m) =>
              m.id === visit.memberId
                ? {
                    ...m,
                    lastVisitAt: visit.completedAt,
                    nextVisitDue: computeNextDue(
                      visit.completedAt,
                      m.visitationFrequency,
                      m.customFrequencyDays,
                    ),
                    scheduledVisitAt: undefined,
                  }
                : m,
            )
          : s.members;
        liveWrite(async () => {
          await liveSetVisit(next);
          const member = members.find((m) => m.id === visit.memberId);
          if (member) await liveSetMember(member);
        });
        return { ...s, visits, members };
      });
      log(approve ? "visit.exception_approved" : "visit.exception_rejected", "visit", visitId);
    },
    [log],
  );

  const markNotificationRead = useCallback((id: string) => {
    setState((s) => {
      const notifications = s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      const note = notifications.find((n) => n.id === id);
      if (note) {
        liveWrite(async () => {
          await liveSetNotification(note);
        });
      }
      return { ...s, notifications };
    });
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<AppState["settings"]>) => {
      setState((s) => {
        const settings = { ...s.settings, ...patch };
        liveWrite(async () => {
          await liveSetSettings(settings);
        });
        return { ...s, settings };
      });
      log("settings.update", "settings", "global", patch);
    },
    [log],
  );

  const importMembers = useCallback(
    (members: Member[]) => {
      setState((s) => ({ ...s, members: [...members, ...s.members] }));
      liveWrite(async () => {
        for (const member of members) await liveSetMember(member);
      });
      log("member.import", "member", "batch", { count: members.length });
      return { added: members.length };
    },
    [log],
  );

  const seedLiveCatalog = useCallback(async () => {
    const result = await seedLiveCatalogRemote();
    if (result.ok) {
      const pulled = await pullLiveState();
      setState((s) => mergeLive(s, pulled));
    }
    return result;
  }, []);

  const resetDemo = useCallback(() => {
    const fresh = createDemoState();
    setState(fresh);
    persistUser(null);
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify({ ...fresh, territories: stripOfficialGeometry(fresh.territories) }),
    );
    attachOfficialGeometries(fresh.territories)
      .then((territories) => setState((s) => ({ ...s, territories })))
      .catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      live: isFirebaseConfigured,
      user,
      state,
      login,
      logout,
      importMembers,
      seedLiveCatalog,
      upsertMember,
      deleteMember,
      upsertUser,
      deleteUser,
      upsertChurch,
      deleteChurch,
      upsertTerritory,
      deleteTerritory,
      upsertCategory,
      recordVisit,
      scheduleVisit,
      cancelScheduledVisit,
      reviewException,
      markNotificationRead,
      updateSettings,
      resetDemo,
      log,
    }),
    [
      ready,
      user,
      state,
      login,
      logout,
      importMembers,
      seedLiveCatalog,
      upsertMember,
      deleteMember,
      upsertUser,
      deleteUser,
      upsertChurch,
      deleteChurch,
      upsertTerritory,
      deleteTerritory,
      upsertCategory,
      recordVisit,
      scheduleVisit,
      cancelScheduledVisit,
      reviewException,
      markNotificationRead,
      updateSettings,
      resetDemo,
      log,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
