import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-[26rem] text-center">
        <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-faint">
          Not found
        </p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight">
          There is nothing at this address
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          The link may be old, or the project may have been opened on another
          device. Your dashboard is where everything current is.
        </p>
        <Link href="/dashboard" className="btn btn-primary btn-md mt-6">
          <ArrowLeft size={15} />
          Back to your dashboard
        </Link>
      </div>
    </div>
  );
}
