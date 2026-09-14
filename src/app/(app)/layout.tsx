import { NowProvider } from "@/lib/now";
import { TaskeyGate } from "@/components/TaskeyGate";
import { AppShell } from "@/components/AppShell";
import { currentUser } from "@clerk/nextjs/server";
import { actor } from "@/lib/auth";

/**
 * The application proper. Who is signed in is a server question, and the
 * answer shapes everything below it: what they can see, what they can do,
 * and whose name lands in the audit trail.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await actor();
  const signedIn = me ? null : await currentUser();

  return (
    <NowProvider>
      <TaskeyGate
        me={me ? { id: me.id } : null}
        email={signedIn?.primaryEmailAddress?.emailAddress}
      >
        <AppShell>{children}</AppShell>
      </TaskeyGate>
    </NowProvider>
  );
}
