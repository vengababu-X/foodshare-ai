'use client';

import { useCallback, useEffect, useState } from 'react';

// Shared "intake open" state for NGOs, persisted in localStorage and kept in
// sync across components (navbar pill + NGO portal toggle) via a custom event.
const STORAGE_KEY = 'fsai:ngo:intake';
const CHANGE_EVENT = 'fsai:intake:change';

export function getIntakeOpen(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === '1';
}

export function setIntakeOpen(open: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
  window.dispatchEvent(
    new CustomEvent<{ open: boolean }>(CHANGE_EVENT, { detail: { open } })
  );
}

/** Hook exposing the current intake state and a toggle that persists it. */
export function useIntakeOpen() {
  // Start "open" so the server render matches; sync from localStorage on mount
  // to avoid hydration mismatches.
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(getIntakeOpen());
    const handler = (event: Event) => {
      setOpen((event as CustomEvent<{ open: boolean }>).detail.open);
    };
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, []);

  const toggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    setIntakeOpen(next);
  }, [open]);

  return { open, toggle };
}
