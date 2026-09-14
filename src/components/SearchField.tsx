"use client";

import clsx from "clsx";
import { Search, X } from "lucide-react";

/**
 * One search field for every list. The old one was a bare icon next to a
 * transparent input that grew on focus: it read as static text until you
 * found it, the hit target was the text itself, and there was no way to
 * clear it other than selecting and deleting.
 */
export function SearchField({
  value,
  onChange,
  label,
  placeholder = "Search",
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Names the field for a screen reader; a list page can have more than one. */
  label: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={clsx("relative", className ?? "w-44")}>
      <Search
        size={14}
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
      />

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            // Stops Escape also closing whatever panel the field sits in.
            e.stopPropagation();
            onChange("");
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        className="h-8 w-full rounded-full bg-sunken pl-8 pr-8 text-[13px] text-ink
                   ring-1 ring-line outline-none transition-shadow
                   placeholder:text-faint focus:bg-surface focus:ring-2 focus:ring-accent/40"
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={`Clear ${label.toLowerCase()}`}
          className="absolute right-1 top-1/2 grid size-6 -translate-y-1/2 place-items-center
                     rounded-full text-faint transition-colors hover:bg-line hover:text-ink"
        >
          <X size={13} strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}
