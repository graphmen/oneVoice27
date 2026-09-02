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
import { SESSION_KEY, STATE_KEY, GIS_DATASET } from "./constants";
import { createDemoState } from "./demo-data";
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
import { computeNextDue, uid } from "./utils";

type StoreContextValue = {
  ready: boolean;
  user: UserAccount | null;
  state: AppState;
  login: (email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  upsertMember: (member: Member) => void;
  deleteMember: (id: string) => void;
  upsertUser: (account: UserAccount) => void;
  upsertChurch: (church: Church) => void;
  upsertTerritory: (territory: Territory) => void;
  deleteTerritory: (id: string) => void;
  upsertCategory: (category: VisitCategory) => void;
  recordVisit: (visit: Visit) => void;
  reviewException: (visitId: string, approve: boolean, reviewerId: string) => void;
  markNotificationRead: (id: string) => void;
  updateSettings: (patch: Partial<AppState["settings"]>) => void;
  resetDemo: () => void;
  log: (action: string, entityType: string, entityId: string, metadata?: Record<string, unknown>) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

function migrateState(parsed: AppState, fresh: AppState): AppState {
  const churches = (parsed.churches || []).map((c) => {
    const seed = fresh.churches.find((f) => f.id === c.id);
    return {
      ...seed,
      ...c,
      districtId: remapLegacyTerritoryId(c.districtId || seed?.districtId),
      territoryId: remapLegacyTerritoryId(c.territoryId || seed?.territoryId),
    };
  });
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
    const next = loadState();
    setState(next);
    setUser(loadUser(next.users));
    setReady(true);
    attachOfficialGeometries(next.territories)
      .then((territories) => {
        if (!cancelled) setState((s) => ({ ...s, territories }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

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
    (email: string, password: string) => {
      const match = state.users.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.status === "active",
      );
      if (!match || match.password !== password) {
        return { ok: false, error: "Invalid email or password." };
      }
      persistUser(match);
      setState((s) => ({
        ...s,
        audit: [
          {
            id: uid("aud"),
            actorId: match.id,
            actorName: match.displayName,
            action: "auth.login",
            entityType: "user",
            entityId: match.id,
            createdAt: new Date().toISOString(),
          },
          ...s.audit,
        ],
      }));
      return { ok: true };
    },
    [state.users],
  );

  const logout = useCallback(() => persistUser(null), []);

  const log = useCallback(
    (action: string, entityType: string, entityId: string, metadata?: Record<string, unknown>) => {
      if (!user) return;
      setState((s) => ({
        ...s,
        audit: [
          {
            id: uid("aud"),
            actorId: user.id,
            actorName: user.displayName,
            action,
            entityType,
            entityId,
            metadata,
            createdAt: new Date().toISOString(),
          },
          ...s.audit,
        ].slice(0, 400),
      }));
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
      log("member.upsert", "member", member.id, { name: `${member.firstName} ${member.lastName}` });
    },
    [log],
  );

  const deleteMember = useCallback(
    (id: string) => {
      setState((s) => ({ ...s, members: s.members.filter((m) => m.id !== id) }));
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
      log("user.upsert", "user", account.id, { role: account.role });
    },
    [log],
  );

  const upsertChurch = useCallback(
    (church: Church) => {
      setState((s) => ({
        ...s,
        churches: s.churches.some((c) => c.id === church.id)
          ? s.churches.map((c) => (c.id === church.id ? church : c))
          : [church, ...s.churches],
      }));
      log("church.upsert", "church", church.id);
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
      log("category.upsert", "category", category.id);
    },
    [log],
  );

  const recordVisit = useCallback(
    (visit: Visit) => {
      setState((s) => {
        const visits = s.visits.some((v) => v.id === visit.id)
          ? s.visits.map((v) => (v.id === visit.id ? visit : v))
          : [visit, ...s.visits];
        const members =
          visit.status === "completed" || visit.status === "exception_approved"
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
                      memberType: m.memberType === "crisis" ? "regular" : m.memberType,
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
                  }
                : m,
            )
          : s.members;
        return { ...s, visits, members };
      });
      log(approve ? "visit.exception_approved" : "visit.exception_rejected", "visit", visitId);
    },
    [log],
  );

  const markNotificationRead = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<AppState["settings"]>) => {
      setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
      log("settings.update", "settings", "global", patch);
    },
    [log],
  );

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
      user,
      state,
      login,
      logout,
      upsertMember,
      deleteMember,
      upsertUser,
      upsertChurch,
      upsertTerritory,
      deleteTerritory,
      upsertCategory,
      recordVisit,
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
      upsertMember,
      deleteMember,
      upsertUser,
      upsertChurch,
      upsertTerritory,
      deleteTerritory,
      upsertCategory,
      recordVisit,
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
