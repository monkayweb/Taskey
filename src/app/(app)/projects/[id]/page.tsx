"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { Empty, Panel } from "@/components/ui";
import { ProjectSheet } from "@/components/ProjectSheet";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const project = useTaskey((s) => s.projects.find((p) => p.id === id));

  if (!project) {
    return (
      <div className="p-5 md:p-8">
        <Panel>
          <Empty
            title="No such project"
            detail="It may have been opened on another device, or the link is wrong."
          />
        </Panel>
        <Link
          href="/projects"
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:text-accent-ink"
        >
          <ArrowLeft size={14} />
          Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <div className="min-w-0 space-y-8 p-5 md:p-8">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={14} />
          Projects
        </Link>
        <ProjectSheet project={project} />
      </div>
    </div>
  );
}
