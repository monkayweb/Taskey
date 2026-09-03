"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Bell,
  CalendarCheck,
  ChevronDown,
  CircleHelp,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  LifeBuoy,
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
import { GlobalSearch } from "./GlobalSearch";

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
    <div className="min-h-dvh md:p-5">
      {/* The app is one floating sheet on the periwinkle ground. No
          overflow-hidden here, or the sticky sidebar stops sticking. */}
      <div
        className="mx-auto flex min-h-[calc(100dvh-40px)] w-full max-w-[1420px] bg-sheet md:rounded-[26px]"
        style={{ boxShadow: "var(--shadow-sheet)" }}
      >
        {/* --- sidebar ------------------------------------------------- */}
        <aside className="sticky top-5 hidden max-h-[calc(100dvh-40px)] w-[236px] shrink-0 flex-col overflow-y-auto bg-sheet md:flex md:rounded-l-[26px]">
          <div className="flex h-[68px] items-center gap-2 px-5">
            <span className="grid size-8 place-items-center rounded-xl bg-accent text-white">
              <SquareCheckBig size={17} strokeWidth={2.4} />
            </span>
            <span className="text-[21px] font-bold tracking-tight">
              Taskey<span className="text-accent">.</span>
            </span>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-2">
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
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all",
                    active
                      ? "bg-accent text-white"
                      : "text-muted hover:bg-sunken hover:text-ink",
                  )}
                  style={active ? { boxShadow: "var(--shadow-accent)" } : undefined}
                >
                  <Icon size={17} strokeWidth={2} />
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/admin" && openEscalations > 0 && (
                    <Badge tone={active ? "neutral" : "danger"}>{openEscalations}</Badge>
                  )}
                </Link>
              );
            })}

            <div className="pt-1">
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
          </nav>

          {/* The reference puts a promo card here. Taskey puts the thing that
              actually needs to be one click away. */}
          {me.role === "employee" && (
            <div className="px-3 pb-3">
              <div className="rounded-2xl bg-gradient-to-br from-accent to-purple px-4 py-4 text-center">
                <span className="mx-auto grid size-9 place-items-center rounded-xl bg-white/20 text-white">
                  <LifeBuoy size={18} />
                </span>
                <p className="mt-2 text-[13px] font-semibold text-white">
                  Falling behind?
                </p>
                <p className="mt-1 text-[11px] leading-snug text-white/80">
                  Flag it now instead of explaining it later.
                </p>
                <div className="mt-3">
                  <OverwhelmedButton onDark compact />
                </div>
              </div>
            </div>
          )}

          {/* Demo affordance: real deployments get this from the session. */}
          <div className="px-3 pb-4">
            <label className="eyebrow mb-1.5 block px-1">Viewing as</label>
            <select
              value={currentUserId}
              onChange={(e) => setCurrentUser(e.target.value)}
              className="field h-9 py-0 text-[12px]"
              aria-label="Switch user"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.jobTitle}
                </option>
              ))}
            </select>
          </div>
        </aside>

        {/* --- main ---------------------------------------------------- */}
        <div className="flex min-w-0 flex-1 flex-col bg-content md:rounded-r-[26px] md:border-l md:border-line">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 md:h-[68px] md:flex-nowrap md:px-6 md:py-0">
            <GlobalSearch />

            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-muted lg:block">
                {prettyDate(now)}
              </span>

              <button
                type="button"
                title={`${myFlagCount} items need action`}
                className="relative grid size-9 place-items-center rounded-full bg-surface text-muted ring-1 ring-line transition-colors hover:text-ink"
              >
                <Bell size={16} />
                {myFlagCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-pink px-1 text-[9px] font-bold leading-4 text-white ring-2 ring-content">
                    {myFlagCount}
                  </span>
                )}
              </button>

              <div className="flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-2.5 ring-1 ring-line">
                <Avatar name={me.name} tint={me.tint} size={28} />
                <div className="hidden min-w-0 leading-tight sm:block">
                  <p className="truncate text-[12px] font-semibold">
                    {firstName(me.name)}
                  </p>
                  <p className="truncate text-[10px] text-muted">{me.jobTitle}</p>
                </div>
                <ChevronDown size={13} className="text-faint" />
              </div>
            </div>
          </header>

          {/* Mobile nav */}
          <nav className="flex gap-1 overflow-x-auto px-3 py-2 md:hidden">
            {visibleNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium",
                  pathname === item.href
                    ? "bg-accent text-white"
                    : "bg-surface text-muted ring-1 ring-line",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <main className="w-full flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
