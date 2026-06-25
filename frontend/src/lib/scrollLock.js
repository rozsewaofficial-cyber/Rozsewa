import { useEffect } from 'react';

/**
 * Centralized Scroll Lock System
 *
 * Uses a module-level reference counter so nested/stacked modals
 * increment/decrement safely. The body scroll is only restored when
 * the last active modal closes.
 *
 * Saves and restores the exact overflow and paddingRight values that
 * were set before locking, so it is safe to use alongside any other
 * code that may touch body styles.
 *
 * On desktop, compensates for the scrollbar width disappearing by
 * adding equivalent paddingRight — preventing layout shift.
 *
 * Does NOT interact with height, top, position, or the keyboard-open
 * class — fully compatible with keyboardAvoidance.js.
 */

let lockCount = 0;
let savedOverflow = '';
let savedPaddingRight = '';

export function lockScroll() {
  lockCount++;
  if (lockCount === 1) {
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    savedOverflow = document.body.style.overflow;
    savedPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
}

export function unlockScroll() {
  if (lockCount <= 0) return;
  lockCount--;
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPaddingRight;
    savedOverflow = '';
    savedPaddingRight = '';
  }
}

/**
 * useScrollLock(isOpen)
 *
 * Call this hook inside any component that renders a modal or overlay.
 * Pass the boolean open state. The hook will lock body scroll while
 * isOpen is true and release it (via cleanup) when isOpen becomes false
 * or the component unmounts.
 *
 * @param {boolean} isOpen - Whether the modal/overlay is currently open.
 */
export function useScrollLock(isOpen) {
  useEffect(() => {
    if (!isOpen) return;
    lockScroll();
    return () => unlockScroll();
  }, [isOpen]);
}
