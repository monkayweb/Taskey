"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * A single clock for the whole tree. Every rule in lib/rules.ts is a pure
 * function of state + now, so sharing one Date keeps every panel on a page
 * agreeing about what's overdue.
 */
const NowContext = createContext<Date | null>(null);

export function NowProvider({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  return <NowContext.Provider value={now}>{children}</NowContext.Provider>;
}

export function useNow(): Date {
  const now = useContext(NowContext);
  if (!now) throw new Error("useNow must be used inside <NowProvider>");
  return now;
}
