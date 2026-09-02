"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import {
  IconBell,
  IconCalendar,
  IconChart,
  IconChurch,
  IconClipboard,
  IconClose,
  IconHome,
  IconLogout,
  IconMap,
  IconLayers,
  IconMenu,
  IconSettings,
  IconShield,
  IconSpark,
  IconUsers,
} from "@/components/icons";
import { useStore } from "@/lib/store";
import { cx, initials, ROLE_LABEL } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Monitor", pastorLabel: "Today's flock", icon: IconHome, roles: ["master_admin", "church_admin", "pastor"] },
  { href: "/schedule", label: "Visit schedule", icon: IconCalendar, roles: ["pastor"] },
  { href: "/pastors", label: "Shepherds", icon: IconUsers, roles: ["master_admin", "church_admin"] },
  { href: "/exceptions", label: "Exceptions", icon: IconShield, roles: ["master_admin", "church_admin", "pastor"] },
  { href: "/reports", label: "Reports", icon: IconChart, roles: ["master_admin", "church_admin"] },
  { href: "/members", label: "Members", pastorLabel: "My flock", icon: IconUsers, roles: ["master_admin", "church_admin", "pastor"] },
  { href: "/map", label: "Care map", icon: IconMap, roles: ["pastor"] },
  { href: "/visits", label: "Visit records", icon: IconClipboard, roles: ["master_admin", "church_admin", "pastor"] },
  { href: "/territories", label: "Register", pastorLabel: "Register member", icon: IconChurch, roles: ["master_admin", "church_admin", "pastor"] },
  { href: "/gis", label: "GIS territories", icon: IconLayers, roles: ["master_admin", "church_admin"] },
  { href: "/churches", label: "Churches", icon: IconChurch, roles: ["master_admin", "church_admin"] },
  { href: "/mission", label: "One Voice 27", icon: IconSpark, roles: ["master_admin", "church_admin", "pastor"] },
  { href: "/settings", label: "Settings", icon: IconSettings, roles: ["master_admin"] },
];

export function Shell({ children }: { children: ReactNode }) {
  const { ready, user, logout, state, markNotificationRead } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
  }, [ready, user, router]);

  const items = useMemo(
    () => NAV.filter((n) => user && n.roles.includes(user.role)),
    [user],
  );

  const notes = state.notifications.filter((n) => n.userId === user?.id);
  const unread = notes.filter((n) => !n.read).length;
  const mapPage = pathname === "/gis" || pathname === "/map";

  if (!ready || !user) {
    return (
      <div className="ov-bg grid min-h-screen place-items-center">
        <div className="text-white/70">Preparing SHEPHERD360…</div>
      </div>
    );
  }

  return (
    <div className="ov-bg min-h-screen">
      <div className="flex min-h-screen">
        <aside
          className={cx(
            "fixed inset-y-0 left-0 z-40 w-[280px] border-r border-white/10 bg-[#12001c]/85 p-4 backdrop-blur-xl transition lg:static",
            open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
        >
          <div className="flex items-center justify-between">
            <BrandMark />
            <button className="btn btn-ghost p-2 lg:hidden" onClick={() => setOpen(false)}>
              <IconClose />
            </button>
          </div>
          <p className="mt-5 px-2 text-[0.7rem] uppercase tracking-[0.2em] text-white/40">
            Pastoral visitation
          </p>
          <nav className="mt-3 grid gap-1">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cx(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm",
                    active ? "bg-magenta/20 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <item.icon size={18} />
                  {user.role === "pastor" && item.pastorLabel ? item.pastorLabel : item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className={cx("flex min-w-0 flex-1 flex-col", mapPage && "h-screen overflow-hidden")}>
          <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-[#12001c]/70 px-4 py-3 backdrop-blur-xl">
            <button className="btn btn-ghost p-2 lg:hidden" onClick={() => setOpen(true)}>
              <IconMenu />
            </button>
            <div className="hidden text-sm text-white/60 lg:block">
              {ROLE_LABEL[user.role]} · {state.settings.conferenceName}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button className="btn btn-ghost relative px-3" onClick={() => setNotesOpen((v) => !v)}>
                <IconBell size={18} />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-magenta px-1 text-[10px]">
                    {unread}
                  </span>
                )}
              </button>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-magenta/30 text-xs font-bold">
                  {initials(user.displayName)}
                </div>
                <div className="hidden pr-2 leading-tight sm:block">
                  <div className="text-sm font-medium">{user.displayName}</div>
                  <div className="text-[11px] text-white/50">{user.email}</div>
                </div>
              </div>
              <button
                className="btn btn-ghost px-3"
                onClick={() => {
                  logout();
                  router.push("/");
                }}
              >
                <IconLogout size={18} />
              </button>
            </div>
          </header>
          {notesOpen && (
            <div className="no-print mx-4 mt-3 glass rounded-3xl p-4">
              <div className="mb-2 text-sm font-semibold">Notifications</div>
              <div className="grid max-h-72 gap-2 overflow-auto scrollbar-thin">
                {notes.length === 0 && <div className="text-sm text-white/60">No notifications yet.</div>}
                {notes.map((n) => (
                  <Link
                    key={n.id}
                    href={n.href || "/dashboard"}
                    onClick={() => {
                      markNotificationRead(n.id);
                      setNotesOpen(false);
                    }}
                    className={cx("rounded-2xl p-3", n.read ? "bg-white/5" : "bg-magenta/15")}
                  >
                    <div className="text-sm font-medium">{n.title}</div>
                    <div className="text-xs text-white/65">{n.body}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          <main className={cx("flex-1", mapPage ? "min-h-0 overflow-hidden p-0" : "px-4 py-6 lg:px-8")}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
