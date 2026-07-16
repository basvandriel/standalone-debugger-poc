/**
 * Ink has no scrollable/overflow-clipped container -- a Box with a fixed
 * height does not clip children that exceed it, it just overflows. Every
 * list-like panel (source lines, stack frames, variables, watches, console)
 * must manually slice to whatever is visible, tracking a scroll offset the
 * same way a pager like `less` does.
 *
 * `currentStart` is the panel's own previous window start (component state);
 * this returns the new start that keeps `active` in view with minimal
 * movement, matching scrollIntoView({block: 'nearest'}) behavior.
 */
export function computeWindowStart(total: number, active: number, height: number, currentStart: number): number {
  if (height <= 0 || total <= height) return 0;
  const clampedActive = Math.max(0, Math.min(total - 1, active));
  const maxStart = total - height;
  let start = currentStart;
  if (clampedActive < start) start = clampedActive;
  else if (clampedActive >= start + height) start = clampedActive - height + 1;
  return Math.max(0, Math.min(maxStart, start));
}
