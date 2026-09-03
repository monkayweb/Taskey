"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useNow } from "@/lib/now";
import { dayKey, relativeDays } from "@/lib/date";
import type { Project } from "@/lib/types";
import { Empty, Panel, ProgressRow } from "./ui";

export function InProgressPanel({ projects }: { projects: Project[] }) {
  const now = useNow();
  const today = dayKey(now);
  const addProject = useTaskey((s) => s.addProject);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [dueDate, setDueDate] = useState("");

  const active = projects.filter((p) => p.status !== "complete");

  return (
    <Panel
      title="In progress"
      action={
        <Link
          href="/projects"
          className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent-ink hover:bg-accent/15"
        >
          View all
        </Link>
      }
    >
      {active.length === 0 ? (
        <Empty title="No active projects" />
      ) : (
        <div className="space-y-4">
          {active.slice(0, 3).map((p) => {
            const done = p.milestones.filter((m) => m.done).length;
            const total = p.milestones.length;
            const behind = p.milestones.some((m) => !m.done && m.dueDate < today);
            return (
              <ProgressRow
                key={p.id}
                label={p.name}
                detail={
                  total === 0
                    ? `${p.client} · delivers ${relativeDays(p.dueDate, now)}`
                    : `${p.client} · ${done}/${total} milestones · delivers ${relativeDays(p.dueDate, now)}`
                }
                pct={total === 0 ? 0 : done / total}
                behind={behind}
              />
            );
          })}
        </div>
      )}

      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !dueDate) return;
            addProject({
              name: name.trim(),
              client: client.trim() || "Internal",
              dueDate,
            });
            setName("");
            setClient("");
            setDueDate("");
            setAdding(false);
          }}
          className="mt-4 space-y-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="field h-9 py-0 text-[13px]"
            autoFocus
          />
          <input
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="Client"
            className="field h-9 py-0 text-[13px]"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="field h-9 py-0 text-[13px]"
            aria-label="Delivery date"
          />
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm flex-1">
              Create
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="btn btn-primary btn-md mt-4 w-full"
        >
          Add new project
          <Plus size={15} />
        </button>
      )}
    </Panel>
  );
}
