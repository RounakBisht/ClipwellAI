"use client";
// Shared dialog behaviour: Escape closes, focus moves into the dialog and back out, and (for modals) the page behind stops scrolling.
import { useEffect, useRef } from "react";

export function useDialog<T extends HTMLElement>(open: boolean, onClose: () => void, { modal = false } = {}) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    if (modal) document.body.style.overflow = "hidden";
    requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }));
    return () => {
      document.removeEventListener("keydown", onKey);
      if (modal) document.body.style.overflow = prevOverflow;
      if (before && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, [open, modal]);
  return ref;
}

// Close a modal only when the press both started and ended on the backdrop (not when a text selection ends there).
export function backdropHandlers(onClose: () => void) {
  let downOnBackdrop = false;
  return {
    onMouseDown: (e: React.MouseEvent) => {
      downOnBackdrop = e.target === e.currentTarget;
    },
    onClick: (e: React.MouseEvent) => {
      if (downOnBackdrop && e.target === e.currentTarget) onClose();
      downOnBackdrop = false;
    },
  };
}
