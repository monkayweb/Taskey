"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import {
  ChevronRight,
  ClipboardList,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  LogOut,
  SquareCheckBig,
  TrendingUp,
  Users,
} from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useNow } from "@/lib/now";
import { dayKey } from "@/lib/date";
import { SignOutButton } from "@clerk/nextjs";
import { ROLE_SHORT } from "@/lib/labels";
import { MessageBar } from "./MessageBar";
import { Avatar } from "./ui";
import type { Role } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: typeof ClipboardList;
  roles: Role[];
};

/**
 * The daily checklist and the old admin pages are still on disk, just out of
 * the app until we get to them, so nothing in this shell should link at them.
 *
 * Dashboard is one route with two screens behind it: the practice for
 * management, your own day for everybody else. The numbers are management's
 * alone, so the item is only there for them.
 */
const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["employee", "admin"],
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: ClipboardList,
    roles: ["employee", "admin"],
  },
  {
    href: "/leads",
    label: "Leads",
    icon: Inbox,
    roles: ["employee", "admin"],
  },
  {
    href: "/projects",
    label: "Projects",
    icon: FolderKanban,
    roles: ["employee", "admin"],
  },
  {
    href: "/employees",
    label: "Employees",
    icon: Users,
    roles: ["admin"],
  },
  {
    href: "/kpis",
    label: "The numbers",
    icon: TrendingUp,
    roles: ["admin"],
  },
];

const HOME = "/dashboard";

/**
 * Routes that are real but carry no nav item of their own, so the redirect
 * below does not bounce off them.
 */
const OFF_NAV = ["/account"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const now = useNow();
  const { users, currentUserId, ensureRecurring } = useTaskey();
  const me = users.find((u) => u.id === currentUserId)!;
  const today = dayKey(now);

  // Standing duties appear because the day arrived, not because anybody
  // handed them out. This is idempotent, so it can run on every load and
  // again when the clock rolls past midnight.
  useEffect(() => {
    ensureRecurring(today);
  }, [ensureRecurring, today]);

  const visibleNav = NAV.filter((item) => item.roles.includes(me.role));

  // A parked page is only parked if there is no way in: a deep link or an
  // old bookmark still resolves, so anything off the map goes home.
  const onOwnMap =
    visibleNav.some(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) || OFF_NAV.some((href) => pathname.startsWith(href));

  useEffect(() => {
    if (!onOwnMap) router.replace(HOME);
  }, [onOwnMap, router]);

  return (
    <div className="min-h-dvh">
      {/* The sidebar is pinned to the left edge of the viewport and scrolls
          on its own, so the page underneath can scroll past it. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[236px] flex-col overflow-y-auto border-r border-line bg-sheet md:flex">
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
              pathname === item.href || pathname.startsWith(`${item.href}/`);
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
              >
                <Icon size={17} strokeWidth={2} />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Who is signed in: their own account, and the way out. Not a
            choice of person any more, which is what makes the trail mean
            something. */}
        <div className="border-t border-line p-3">
          <Link
            href="/account"
            className={clsx(
              "flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors",
              pathname === "/account" ? "bg-accent-soft" : "hover:bg-sunken",
            )}
          >
            <Avatar name={me.name} tint={me.tint} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold">
                {me.name}
              </span>
              <span
                className={clsx(
                  "block truncate text-[11px]",
                  pathname === "/account" ? "text-accent-ink" : "text-faint",
                )}
              >
                {ROLE_SHORT[me.workRole]}
              </span>
            </span>
            <ChevronRight size={14} className="shrink-0 text-faint" />
          </Link>

          <SignOutButton>
            <button
              type="button"
              className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-[12px] font-medium text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <LogOut size={15} className="shrink-0" />
              Sign out
            </button>
          </SignOutButton>
        </div>
      </aside>

      {/* --- main ------------------------------------------------------ */}
      <div className="flex min-h-dvh min-w-0 flex-col bg-content md:pl-[236px]">
        {/* Mobile nav, since the rail is hidden below md. The account sits
            at the end of it: on a phone the rail is the only way to your own
            account and the way out, and the rail is not there. */}
        <nav className="tab-strip flex items-center gap-1 border-b border-line px-3 py-2 md:hidden">
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

          <Link
            href="/account"
            aria-label={`Your account, ${me.name}`}
            className={clsx(
              "ml-1 flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-[13px] font-medium",
              pathname === "/account"
                ? "bg-accent text-white"
                : "bg-surface text-muted ring-1 ring-line",
            )}
          >
            <Avatar name={me.name} tint={me.tint} size={22} />
            You
          </Link>
        </nav>

        <BusyBar />
        <main className="w-full flex-1">{children}</main>
        <MessageBar />
      </div>
    </div>
  );
}

/**
 * A thin line across the top of the content while the server is working.
 *
 * Every action here writes and then reads the whole workspace back, which
 * takes a moment against a database in another country. Without this the
 * screen simply sits there and the click feels lost.
 */
function BusyBar() {
  const busy = useTaskey((s) => s.busy);
  if (busy === 0) return null;

  return (
    <div
      role="progressbar"
      aria-busy="true"
      aria-label="Working"
      className="busy-bar sticky top-0 z-40 h-[3px] overflow-hidden bg-accent-soft"
    />
  );
}
