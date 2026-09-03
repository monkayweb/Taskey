"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Search, X } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useNow } from "@/lib/now";
import { dayKey } from "@/lib/date";
import { money } from "@/lib/rules";
import { STAGE_LABEL } from "@/lib/labels";

interface Hit {
  group: string;
  label: string;
  detail: string;
  href: string;
}

/** Searches what actually exists: leads, projects and today's blocks. */
export function GlobalSearch() {
  const router = useRouter();
  const now = useNow();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { leads, projects, logs, currentUserId } = useTaskey();

  const hits = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    const out: Hit[] = [];

    for (const l of leads) {
      if (
        l.company.toLowerCase().includes(term) ||
        l.contactName.toLowerCase().includes(term)
      )
        out.push({
          group: "Leads",
          label: l.company,
          detail: `${l.contactName} · ${STAGE_LABEL[l.stage]} · ${money(l.value)}`,
          href: "/leads",
        });
    }

    for (const p of projects) {
      if (
        p.name.toLowerCase().includes(term) ||
        p.client.toLowerCase().includes(term)
      )
        out.push({
          group: "Projects",
          label: p.name,
          detail: `${p.client} · ${p.milestones.filter((m) => m.done).length}/${p.milestones.length} milestones`,
          href: "/projects",
        });
    }

    const log = logs.find(
      (l) => l.userId === currentUserId && l.date === dayKey(now),
    );
    for (const b of log?.blocks ?? []) {
      if (b.label.toLowerCase().includes(term))
        out.push({
          group: "Today's blocks",
          label: b.label,
          detail: `${b.start}–${b.end}`,
          href: "/today",
        });
    }

    return out.slice(0, 8);
  }, [q, leads, projects, logs, currentUserId, now]);

  const grouped = hits.reduce<Record<string, Hit[]>>((acc, h) => {
    (acc[h.group] ??= []).push(h);
    return acc;
  }, {});

  return (
    <div className="relative w-full max-w-[320px]">
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
      />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="Search leads, projects, blocks"
        aria-label="Search"
        className="field h-9 rounded-full bg-sunken pl-9 pr-8 text-[13px]"
      />
      {q && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            setOpen(false);
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-ink"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-2xl bg-surface ring-1 ring-line shadow-[var(--shadow-pop)]">
          {hits.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted">
              Nothing matches “{q.trim()}”
            </p>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="border-b border-line last:border-b-0">
                <p className="eyebrow px-3 pb-1 pt-2">{group}</p>
                {items.map((h, i) => (
                  <button
                    key={`${h.label}-${i}`}
                    type="button"
                    onMouseDown={() => {
                      if (blurTimer.current) clearTimeout(blurTimer.current);
                    }}
                    onClick={() => {
                      router.push(h.href);
                      setQ("");
                      setOpen(false);
                    }}
                    className={clsx(
                      "block w-full px-3 py-2 text-left transition-colors hover:bg-sunken",
                    )}
                  >
                    <span className="block truncate text-[13px] font-medium">
                      {h.label}
                    </span>
                    <span className="block truncate text-[11px] text-muted">
                      {h.detail}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
