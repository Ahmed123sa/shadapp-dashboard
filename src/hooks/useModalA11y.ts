'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared accessibility behavior for modal-style overlays (dialogs, sheets,
 * popovers that block interaction with the rest of the page while open):
 * - moves focus into the dialog when it opens (first focusable element, or
 *   the dialog container itself if nothing inside is focusable)
 * - returns focus to whatever element triggered the open, once it closes
 * - closes on Escape
 *
 * Consumers attach `dialogRef` and spread `dialogProps` onto the dialog's
 * outermost panel element (not the backdrop):
 *
 *   const { dialogRef, dialogProps } = useModalA11y(open, onClose);
 *   <div ref={dialogRef} {...dialogProps} onClick={(e) => e.stopPropagation()}>
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void) {
  const dialogRef = useRef<T>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement | null;

    // Deferred so the dialog's own contents (rendered this same tick) exist
    // in the DOM before we go looking for something to focus.
    const id = window.setTimeout(() => {
      const node = dialogRef.current;
      if (!node) return;
      const focusable = node.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (focusable || node).focus();
    }, 0);

    return () => {
      window.clearTimeout(id);
      triggerRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return {
    dialogRef,
    dialogProps: {
      role: 'dialog' as const,
      'aria-modal': true as const,
      tabIndex: -1 as const,
    },
  };
}
