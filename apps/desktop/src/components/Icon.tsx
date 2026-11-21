import type { LucideIcon } from "lucide-react";

/** Lucide at the system's rounder, heavier stroke (2.75), on currentColor. */
export function Icon({ as: Comp, size = 18, className }: { as: LucideIcon; size?: number; className?: string }) {
  return <Comp size={size} strokeWidth={2.75} aria-hidden="true" className={className} />;
}
