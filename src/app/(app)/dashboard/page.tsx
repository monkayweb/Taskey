"use client";

import { useTaskey } from "@/lib/store";
import { AdminDashboard } from "@/components/AdminDashboard";
import { MyDashboard } from "@/components/MyDashboard";

/**
 * Home. Two genuinely different screens behind one route, because they answer
 * two different questions: management asks what the practice is doing, and
 * everybody else asks what they should do next.
 */
export default function DashboardPage() {
  const { users, currentUserId } = useTaskey();
  const me = users.find((u) => u.id === currentUserId)!;

  return me.role === "admin" ? (
    <div className="min-h-dvh">
      <AdminDashboard me={me} />
    </div>
  ) : (
    <div className="min-h-dvh">
      <MyDashboard me={me} />
    </div>
  );
}
