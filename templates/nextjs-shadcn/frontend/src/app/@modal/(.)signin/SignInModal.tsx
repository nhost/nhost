'use client';

import { useRouter } from 'next/navigation';
import { SIGN_IN_DESCRIPTION, SIGN_IN_TITLE } from '@/app/signin/copy';
import SignInForm from '@/app/signin/SignInForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * The sign-in form over the page that asked for it.
 *
 * Only ever rendered through the interception, so there is always a page
 * underneath and a history entry to return to: dismissing goes back rather
 * than routing somewhere, which leaves the visitor exactly where they were.
 *
 * Signing in takes the whole document with it rather than routing, so the
 * dialog goes away with the page it was drawn on and cannot leave its overlay
 * behind over the page it just sent you to.
 */
export function SignInModal({ next }: { next: string }) {
  const router = useRouter();

  return (
    <Dialog
      defaultOpen
      onOpenChange={(open) => {
        if (!open) {
          router.back();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{SIGN_IN_TITLE}</DialogTitle>
          <DialogDescription>{SIGN_IN_DESCRIPTION}</DialogDescription>
        </DialogHeader>

        <SignInForm next={next} />
      </DialogContent>
    </Dialog>
  );
}
