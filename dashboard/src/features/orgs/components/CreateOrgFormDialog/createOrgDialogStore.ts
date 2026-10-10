import { useSyncExternalStore } from 'react';

// The header opens this dialog from the organization combobox on desktop and
// from the navigation sheet on mobile, while it renders the dialog once. They
// share its state here.

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

export function setCreateOrgDialogOpen(next: boolean) {
  if (open === next) {
    return;
  }

  open = next;
  for (const listener of listeners) {
    listener();
  }
}

export const openCreateOrgDialog = () => setCreateOrgDialogOpen(true);

export const useCreateOrgDialogOpen = () =>
  useSyncExternalStore(subscribe, getOpen, getServerOpen);
