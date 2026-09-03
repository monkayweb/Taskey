"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Bell,
  CalendarCheck,
  CircleHelp,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  ScrollText,
  Settings,
  SquareCheckBig,
} from "lucide-react";
import { useTaskey } from "@/lib/store";
import type { Role } from "@/lib/types";
import { useFlags } from "@/lib/selectors";
import { useNow } from "@/lib/now";
import { prettyDate } from "@/lib/date";
import { Avatar, Badge } from "./ui";
import { OverwhelmedButton } from "./OverwhelmedButton";

type NavItem = {
  href: string;
  label: string;
  icon: typeof CalendarCheck;
  roles: Role[];
};

const NAV: NavItem[] = [
  { href: "/today", label: "My day", icon: CalendarCheck, roles: ["employee", "admin"] },
  { href: "/leads", label: "Leads & quotes", icon: Handshake, roles: ["employee", "admin"] },
  { href: "/projects", label: "Projects", icon: FolderKanban, roles: ["employee", "admin"] },
  { href: "/admin", label: "Admin dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { href: "/admin/audit", label: "Audit trail", icon: ScrollText, roles: ["admin"] },
];

const firstName = (name: string) => name.split(" ")[0];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const now = useNow();
  const { users, currentUserId, setCurrentUser, escalations } = useTaskey();
  const me = users.find((u) => u.id === currentUserId)!;
  const flags = useFlags();

  const myFlagCount = flags.filter(
    (f) => me.role === "admin" || f.ownerId === me.id,
  ).length;
  const openEscalations = escalations.filter((e) => e.status === "open").length;
  const visibleNav = NAV.filter((item) => item.roles.includes(me.role));

  return (
    <div className="flex min-h-dvh">
      {/* --- sidebar --------------------------------------------------- */}
      <aside className="hidden w-[228px] shrink-0 flex-col bg-surface md:flex">
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="grid size-8 place-items-center rounded-xl bg-accent text-white">
            <SquareCheckBig size={17} strokeWidth={2.4} />
          </span>
          <span className="text-[19px] font-semibold tracking-tight">Taskey</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-3">
          {visibleNav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-accent-soft text-accent-ink"
                    : "text-muted hover:bg-sunken hover:text-ink",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />
                )}
                <Icon size={17} strokeWidth={2} />
                <span className="flex-1">{item.label}</span>
                {item.href === "/admin" && openEscalations > 0 && (
                  <Badge tone="danger">{openEscalations}</Badge>
                )}
              </Link>
            );
          })}
        </nav>

        {me.role === "employee" && (
          <div className="px-3 pb-2">
            <OverwhelmedButton />
          </div>
        )}

        <div className="space-y-1 px-3 pb-2">
          {[
            { label: "Support", icon: CircleHelp },
            { label: "Settings", icon: Settings },
          ].map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <Icon size={17} strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>

        {/* Demo affordance: real deployments get this from the session. */}
        <div className="px-3 pb-4">
          <div className="rounded-2xl bg-sunken p-2.5">
            <label className="eyebrow mb-1.5 block">Viewing as</label>
            <div className="flex items-center gap-2">
              <Avatar name={me.name} tint={me.tint} />
              <select
                value={currentUserId}
                onChange={(e) => setCurrentUser(e.target.value)}
                className="field h-8 flex-1 bg-surface py-0 text-[12px]"
                aria-label="Switch user"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.jobTitle}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </aside>

      {/* --- main ------------------------------------------------------ */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 px-4 md:px-8">
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold tracking-tight">
              Hi, {firstName(me.name)}
            </p>
            <p className="truncate text-xs text-accent">
              {me.role === "admin"
                ? `${prettyDate(now)} — here's where the team stands`
                : "Let's close out your day properly"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:block">{prettyDate(now)}</span>
            <div
              className="relative grid size-9 place-items-center rounded-full bg-surface text-muted shadow-[var(--shadow-card)]"
              title={`${myFlagCount} items need action`}
            >
              <Bell size={16} />
              {myFlagCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-danger-fill px-1 text-[9px] font-bold leading-4 text-white ring-2 ring-canvas">
                  {myFlagCount}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium",
                pathname === item.href
                  ? "bg-accent text-white"
                  : "bg-surface text-muted",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-8 pt-1 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
