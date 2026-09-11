import { useRef } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/v3/alert-dialog';

interface DiscardChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscardChanges: () => void;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
}

export default function DiscardChangesDialog({
  open,
  onOpenChange,
  onDiscardChanges,
  onEscapeKeyDown,
}: DiscardChangesDialogProps) {
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  function rememberFocus() {
    const element = document.activeElement;

    previouslyFocusedElementRef.current =
      element instanceof HTMLElement ? element : null;
  }

  function restoreFocus(event: Event) {
    const element = previouslyFocusedElementRef.current;
    previouslyFocusedElementRef.current = null;

    if (!element?.isConnected) {
      return;
    }

    event.preventDefault();
    element.focus();
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="text-foreground"
        onOpenAutoFocus={rememberFocus}
        onCloseAutoFocus={restoreFocus}
        onEscapeKeyDown={onEscapeKeyDown}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved local changes. Are you sure you want to discard
            them?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDiscardChanges}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
