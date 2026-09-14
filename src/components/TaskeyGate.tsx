"use client";

import { useEffect } from "react";
import { SignOutButton } from "@clerk/nextjs";
import { MailQuestion, SquareCheckBig } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { Skeleton, SkeletonPanel, SkeletonTile } from "./ui";

/**
 * Holds the first paint until two things are true: we know who is signed in,
 * and their workspace has arrived. Everything below assumes both, which is
 * what lets the screens keep asserting that the current user exists.
 */
export function TaskeyGate({
  me,
  email,
  children,
}: {
  /** The team member behind the session, resolved on the server. */
  me: { id: string } | null;
  /** Whoever is signed in with Clerk, seat or no seat. */
  email?: string;
  children: React.ReactNode;
}) {
  const { ready, users, load, setCurrentUser } = useTaskey();

  useEffect(() => {
    if (!me) return;
    setCurrentUser(me.id);
    void load();
  }, [me, load, setCurrentUser]);

  if (!me) return <NoSeat email={email} />;
  if (!ready || users.length === 0) return <Loading />;
  return <>{children}</>;
}

/** Signed in with Clerk, but nobody has put them on the team. */
function NoSeat({ email }: { email?: string }) {
  return (
    <Centred>
      <div className="card overflow-hidden">
        <div className="flex items-start gap-4 px-7 pb-6 pt-7">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warn-soft text-warn">
            <MailQuestion size={19} />
          </span>
          <div className="min-w-0">
            <h1 className="text-[17px] font-bold tracking-tight">
              You are not on the team yet
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              Your sign-in worked. Taskey just has no seat for{" "}
              {email ? (
                <span className="font-medium text-ink">{email}</span>
              ) : (
                "this address"
              )}
              , so there is nothing here for you to see.
            </p>
          </div>
        </div>

        <div className="border-t border-line bg-sunken/60 px-7 py-5">
          <p className="eyebrow">What to do</p>
          <ol className="mt-2.5 space-y-2 text-[13px] text-muted">
            <li className="flex gap-2.5">
              <span className="font-semibold text-accent">1</span>
              Ask Patricia to add this exact address under Employees.
            </li>
            <li className="flex gap-2.5">
              <span className="font-semibold text-accent">2</span>
              Sign in again. The seat attaches itself the first time you do.
            </li>
          </ol>
          <p className="mt-4 text-[12px] text-faint">
            Signed in with the wrong address? Sign out and try the other one.
          </p>
        </div>

        <div className="flex items-center gap-2 border-t border-line px-7 py-4">
          <SignOutButton>
            <button type="button" className="btn btn-primary btn-md">
              Sign out
            </button>
          </SignOutButton>
        </div>
      </div>
    </Centred>
  );
}

/**
 * The app arriving, rather than a spinner.
 *
 * It is the real shell with the real geometry: the rail on the left with its
 * mark already drawn, and page-shaped blocks where the cards will be. Somebody
 * waiting two seconds should see Taskey loading, not a blank screen with a
 * dot on it.
 */
function Loading() {
  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[236px] flex-col border-r border-line bg-sheet md:flex">
        <div className="flex h-[68px] items-center gap-2 px-5">
          <span className="grid size-8 place-items-center rounded-xl bg-accent text-white">
            <SquareCheckBig size={17} strokeWidth={2.4} />
          </span>
          <span className="text-[21px] font-bold tracking-tight">
            Taskey<span className="text-accent">.</span>
          </span>
        </div>

        <div className="flex-1 space-y-1 px-3 py-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <Skeleton className="shrink-0 rounded-md" w={17} h={17} />
              <Skeleton w={i === 1 ? "58%" : "44%"} h={10} />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2.5 border-t border-line p-5">
          <Skeleton className="shrink-0 rounded-full" w={28} h={28} />
          <span className="min-w-0 flex-1">
            <Skeleton w="70%" h={9} />
            <Skeleton className="mt-1.5" w="45%" h={8} />
          </span>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col bg-content md:pl-[236px]">
        <div className="min-w-0 space-y-8 p-5 md:p-8">
          <div className="flex items-center gap-3">
            <Skeleton w="18%" h={16} />
            <span className="ml-auto">
              <Skeleton className="rounded-full" w={92} h={28} />
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonTile key={i} />
            ))}
          </div>

          <SkeletonPanel rows={4} />

          <p className="flex items-center justify-center gap-2 text-[12px] text-faint">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" />
            Loading the practice
          </p>
        </div>
      </div>
    </div>
  );
}

/** The one frame all of these sit in: the app's ground, centred. */
function Centred({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-[30rem] space-y-4">
        <div className="flex items-center justify-center gap-2">
          <span className="text-[19px] font-bold tracking-tight">
            Taskey<span className="text-accent">.</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
