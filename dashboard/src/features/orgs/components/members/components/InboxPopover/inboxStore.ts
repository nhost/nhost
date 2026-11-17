import { createRef, useSyncExternalStore } from 'react';

// The inbox opens from the header bell on desktop and from the account menu on
// mobile, while a single `InboxPopover` renders it. They share its state here.

let open = false;
const listeners = new Set<VoidFunction>();

function subscribe(listener: VoidFunction) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getOpen = () => open;
const getServerOpen = () => false;

export function setInboxOpen(next: boolean) {
  if (open === next) {
    return;
  }

  open = next;
  for (const listener of listeners) {
    listener();
  }
}

export const openInbox = () => setInboxOpen(true);

/** The current open state, for event handlers that run outside render. */
export const isInboxOpen = getOpen;

export const useInboxOpen = () =>
  useSyncExternalStore(subscribe, getOpen, getServerOpen);

/**
 * What the inbox attaches to and returns focus to: the bell on desktop, the
 * account menu trigger on mobile. Only one of them is mounted at a time.
 */
export const inboxAnchorRef = createRef<HTMLButtonElement>();

export const INBOX_POPOVER_ID = 'inbox-popover';
