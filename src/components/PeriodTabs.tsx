"use client";

import clsx from "clsx";
import { PERIOD_LABEL, type PeriodKey } from "@/lib/date";
import { Tabs } from "./ui";

const OPTIONS: { value: PeriodKey; label: string }[] = (
  ["week", "month", "year", "all"] as PeriodKey[]
).map((value) => ({ value, label: PERIOD_LABEL[value] }));

/** The window every score and card on a page is measured over. */
export function PeriodTabs({
  value,
  onChange,
  className,
}: {
  value: PeriodKey;
  onChange: (next: PeriodKey) => void;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <Tabs value={value} options={OPTIONS} onChange={onChange} />
    </div>
  );
}
