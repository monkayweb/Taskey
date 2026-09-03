"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * The lavender welcome card. Decorative artwork is an inline SVG so the page
 * ships no image requests.
 */
export function HeroBanner({
  title,
  subtitle,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <section className="card relative overflow-hidden bg-accent-wash">
      <div className="flex items-center justify-between gap-4 px-6 py-6">
        <div className="min-w-0 max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-accent-ink">
            {title}
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{subtitle}</p>
          <Link href={ctaHref} className="btn btn-primary btn-md mt-4">
            {ctaLabel}
            <ArrowRight size={15} />
          </Link>
        </div>
        <Artwork />
      </div>
    </section>
  );
}

function Artwork() {
  return (
    <svg
      viewBox="0 0 220 150"
      className="hidden h-[130px] w-[190px] shrink-0 sm:block"
      aria-hidden
    >
      {/* soft ground */}
      <circle cx="120" cy="80" r="66" fill="#7c3aed" opacity="0.09" />
      <circle cx="186" cy="34" r="13" fill="#7c3aed" opacity="0.16" />
      <circle cx="30" cy="116" r="8" fill="#7c3aed" opacity="0.2" />

      {/* checklist card */}
      <g transform="rotate(-6 92 78)">
        <rect x="48" y="34" width="90" height="88" rx="12" fill="#fff" />
        <rect x="48" y="34" width="90" height="88" rx="12" fill="none" stroke="#e9e3fd" strokeWidth="1.5" />
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(60 ${50 + i * 22})`}>
            <rect width="14" height="14" rx="4.5" fill={i < 2 ? "#7c3aed" : "#f1ecfe"} />
            {i < 2 && (
              <path
                d="M4 7.4l2.6 2.6L10.4 4.6"
                fill="none"
                stroke="#fff"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            <rect x="22" y="3.5" width={i === 2 ? 34 : 48} height="3.5" rx="1.75" fill="#ddd9ec" />
            <rect x="22" y="10.5" width={i === 2 ? 22 : 30} height="3" rx="1.5" fill="#edebf5" />
          </g>
        ))}
      </g>

      {/* clock */}
      <g transform="translate(146 82)">
        <circle r="25" fill="#fff" />
        <circle r="25" fill="none" stroke="#e9e3fd" strokeWidth="2" />
        <circle r="18.5" fill="none" stroke="#f1ecfe" strokeWidth="1.5" />
        <path d="M0 0V-12" stroke="#7c3aed" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M0 0L9 5" stroke="#a78bfa" strokeWidth="2.6" strokeLinecap="round" />
        <circle r="2.2" fill="#5b21b6" />
      </g>

      {/* accent ticks */}
      <path
        d="M176 118l4 4 7-8"
        fill="none"
        stroke="#0ca30c"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      <path
        d="M22 44l3.4 3.4L31 41"
        fill="none"
        stroke="#7c3aed"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.45"
      />
    </svg>
  );
}
