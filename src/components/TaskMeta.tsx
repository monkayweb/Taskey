import clsx from "clsx";
import { CATEGORY_ICON, CATEGORY_LABEL } from "@/lib/labels";
import type { Assignment } from "@/lib/types";

/**
 * What kind of work a task is. Shared so a task looks the same on the task
 * list and on an employee's own page. Urgency is not a mark: the row itself
 * is filled instead.
 */
export function CategoryMark({
  category,
  className,
}: {
  category: Assignment["category"];
  className?: string;
}) {
  const Icon = CATEGORY_ICON[category];
  return (
    <span
      className={clsx(
        "grid size-9 shrink-0 place-items-center rounded-xl bg-sunken text-muted",
        className,
      )}
    >
      <Icon size={16} strokeWidth={2} aria-hidden />
      {/* The icon is the only thing naming the category now, so the name
          still has to be readable to a screen reader. */}
      <span className="sr-only">{CATEGORY_LABEL[category]}</span>
    </span>
  );
}
