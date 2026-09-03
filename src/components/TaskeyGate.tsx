"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useTaskey } from "@/lib/store";

const subscribe = (onChange: () => void) =>
  useTaskey.persist.onFinishHydration(onChange);
const getSnapshot = () => useTaskey.persist.hasHydrated();
/** The server has no localStorage, so it is never hydrated. */
const getServerSnapshot = () => false;

/**
 * State lives in localStorage, which the server can't see. Rehydrate on the
 * client and hold the first paint until it lands, so nothing renders against
 * seed data that's about to be replaced.
 */
export function TaskeyGate({ children }: { children: React.ReactNode }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    if (!hydrated) void useTaskey.persist.rehydrate();
  }, [hydrated]);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-faint">
          <span className="size-2 animate-pulse rounded-full bg-accent" />
          Loading Taskey…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
