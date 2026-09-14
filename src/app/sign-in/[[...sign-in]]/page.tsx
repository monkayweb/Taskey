import { SignIn } from "@clerk/nextjs";
import { SquareCheckBig } from "lucide-react";

/**
 * Two halves: what this is, and the way in. The left panel is the only place
 * in the app that explains itself, because it is the only page somebody sees
 * before they have any of the work in front of them.
 */
export default function SignInPage() {
  return (
    <div className="auth-page grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      {/* --- what it is ------------------------------------------------ */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-accent px-12 py-14 lg:flex">
        {/* One quiet shape, so the panel is not a flat block of indigo. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 size-[520px] rounded-full bg-white/[0.07]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 size-[420px] rounded-full bg-white/[0.05]"
        />

        <div className="relative flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-white/15 text-white">
            <SquareCheckBig size={19} strokeWidth={2.4} />
          </span>
          <span className="text-[22px] font-bold tracking-tight text-white">
            Taskey<span className="text-white/60">.</span>
          </span>
        </div>

        <div className="relative max-w-[26rem]">
          <h1 className="text-[30px] font-semibold leading-[1.15] tracking-tight text-white">
            A project sheet opens itself the day a client pays.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-white/70">
            Every date is counted from that payment, every step sits with one
            person, and whatever is late says so without anybody being asked
            for a status update.
          </p>

          <ol className="mt-9 space-y-3">
            {[
              "Payment loaded, sheet dated",
              "Documents requested, client chased",
              "QC signed off, then submitted",
              "Balance collected, outcome recorded",
            ].map((line, i) => (
              <li key={line} className="flex items-center gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/15 text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-[13px] text-white/85">{line}</span>
              </li>
            ))}
          </ol>
        </div>

        <p className="relative text-[12px] text-white/50">
          Pharmers regulatory practice
        </p>
      </section>

      {/* --- the way in ------------------------------------------------ */}
      <section className="flex flex-col justify-center bg-sheet px-6 py-14 sm:px-12">
        <div className="mx-auto w-full max-w-[26rem]">
          {/* The mark again on small screens, where the left panel is gone. */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="grid size-8 place-items-center rounded-xl bg-accent text-white">
              <SquareCheckBig size={17} strokeWidth={2.4} />
            </span>
            <span className="text-[20px] font-bold tracking-tight">
              Taskey<span className="text-accent">.</span>
            </span>
          </div>

          <h2 className="text-[22px] font-semibold tracking-tight">
            Sign in
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            Use your work email address.
          </p>

          {/* Clerk's own heading is hidden in globals.css, so the words here
              are ours and there is no gap where its title used to be. */}
          <div className="mt-6">
            <SignIn appearance={{ elements: { rootBox: "w-full" } }} />
          </div>

          <p className="mt-8 border-t border-line pt-5 text-[12px] leading-relaxed text-faint">
            Taskey is by invitation. If your address has not been added to the
            practice yet, ask Patricia to add you and then sign in again.
          </p>
        </div>
      </section>
    </div>
  );
}
