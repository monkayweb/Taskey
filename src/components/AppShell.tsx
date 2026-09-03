"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  CalendarCheck,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  ScrollText,
  TriangleAlert,
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

  return (
    <div className="flex min-h-dvh">
      {/* --- sidebar --------------------------------------------------- */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-line px-4">
          <span className="grid size-7 place-items-center rounded-lg bg-accent text-[13px] font-bold text-white">
            T
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Taskey</span>
        </div>

        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.filter((item) => item.roles.includes(me.role)).map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-accent-soft text-accent-ink"
                    : "text-muted hover:bg-sunken hover:text-ink",
                )}
              >
                <Icon size={16} strokeWidth={2} />
                <span className="flex-1">{item.label}</span>
                {item.href === "/admin" && openEscalations > 0 && (
                  <Badge tone="danger">{openEscalations}</Badge>
                )}
              </Link>
            );
          })}
        </nav>

        {me.role === "employee" && (
          <div className="border-t border-line p-3">
            <OverwhelmedButton />
          </div>
        )}

        {/* Demo affordance: real deployments get this from the session. */}
        <div className="border-t border-line p-3">
          <label className="eyebrow mb-1.5 block">Viewing as</label>
          <div className="flex items-center gap-2">
            <Avatar name={me.name} tint={me.tint} />
            <select
              value={currentUserId}
              onChange={(e) => setCurrentUser(e.target.value)}
              className="field h-8 flex-1 py-0 text-[13px]"
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
      </aside>

      {/* --- main ------------------------------------------------------ */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-line bg-surface/90 px-4 backdrop-blur md:px-6">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">{prettyDate(now)}</p>
            <p className="truncate text-xs text-muted">
              {me.name} · {me.jobTitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {myFlagCount > 0 && (
              <Badge tone={myFlagCount > 3 ? "danger" : "warn"}>
                <TriangleAlert size={11} />
                {myFlagCount} needing action
              </Badge>
            )}
          </div>
        </header>

        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-3 py-2 md:hidden">
          {NAV.filter((item) => item.roles.includes(me.role)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium",
                pathname === item.href
                  ? "bg-accent-soft text-accent-ink"
                  : "text-muted",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
