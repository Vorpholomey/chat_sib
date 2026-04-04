/** Viewport padding when clamping fixed floating menus (matches prior sidebar behavior). */
export const FLOATING_MENU_GAP = 8;

export function computeFloatingMenuLeft(rect: DOMRect, menuMinWidth: number): number {
  const left = rect.right - menuMinWidth;
  return Math.max(
    FLOATING_MENU_GAP,
    Math.min(left, window.innerWidth - menuMinWidth - FLOATING_MENU_GAP)
  );
}

/** Initial vertical position before measuring menu height (estimate for flip). */
export function computeFloatingMenuTopInitial(
  rect: DOMRect,
  estimatedMenuHeight: number
): number {
  let top = rect.bottom + 4;
  if (top + estimatedMenuHeight > window.innerHeight - FLOATING_MENU_GAP) {
    top = rect.top - estimatedMenuHeight - 4;
  }
  if (top < FLOATING_MENU_GAP) top = FLOATING_MENU_GAP;
  return top;
}

/** Refine top using measured menu height so nothing is cut off at the bottom. */
export function computeFloatingMenuTopRefined(rect: DOMRect, menuHeight: number): number {
  let top = rect.bottom + 4;
  if (top + menuHeight > window.innerHeight - FLOATING_MENU_GAP) {
    top = rect.top - menuHeight - 4;
  }
  if (top < FLOATING_MENU_GAP) top = FLOATING_MENU_GAP;
  return top;
}

/**
 * Places a fixed menu near a pointer position, preferring below the point.
 * Clamps so the full menu rectangle stays inside `bounds` (e.g. the chat thread).
 */
export function positionMenuNearPointInBounds(
  clientX: number,
  clientY: number,
  menuWidth: number,
  menuHeight: number,
  bounds: DOMRect
): { left: number; top: number } {
  const gap = FLOATING_MENU_GAP;
  let left = clientX;
  let top = clientY + 4;

  if (top + menuHeight > bounds.bottom - gap) {
    top = clientY - menuHeight - 4;
  }

  if (left + menuWidth > bounds.right - gap) {
    left = bounds.right - menuWidth - gap;
  }

  if (left < bounds.left + gap) {
    left = bounds.left + gap;
  }

  if (top < bounds.top + gap) {
    top = bounds.top + gap;
  }

  if (top + menuHeight > bounds.bottom - gap) {
    top = Math.max(bounds.top + gap, bounds.bottom - gap - menuHeight);
  }
  if (left + menuWidth > bounds.right - gap) {
    left = Math.max(bounds.left + gap, bounds.right - gap - menuWidth);
  }

  return { left, top };
}
