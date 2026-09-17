'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { PROFILE_DESCRIPTION, PROFILE_TITLE } from '@/app/profile/copy';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * The profile over the page that asked for it.
 *
 * Taller than sign-in and it grows with the account, so the contents scroll
 * inside the dialog rather than the dialog growing past the viewport. The
 * heading scrolls away with them, being a description of the thing rather than
 * a control. The close button is the one fixed part, so there is always a way
 * out no matter how far down you are.
 */
export function ProfileModal({ children }: { children: ReactNode }) {
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
      {/* No padding above or below the scrolling contents: those gaps read as
          dead space while the content behind them was still cut off. The sides
          get more than the dialog's usual, so scrolling cards clear the close
          button with room to spare rather than sliding under it, and stay off
          it on a phone too, where the dialog runs to the screen's edges. The
          height cap and width come from the dialog itself. */}
      <DialogContent className="px-10 py-0 sm:max-w-2xl sm:px-12">
        {/* `min-h-0` is what lets this shrink inside the flex column; without
            it the contents keep their full height and push the dialog past the
            screen instead of scrolling. */}
        {/* The space above the heading and under the last card belongs to the
            scrolling contents, not to the dialog: it shows at either end of
            the scroll rather than sitting there while the content behind it
            is still cut off. More of it at the bottom, so there is somewhere
            to scroll to once the last card is in view. */}
        <div className="no-scrollbar flex min-h-0 flex-col gap-4 overflow-y-auto pt-8 pb-16">
          <DialogHeader>
            <DialogTitle>{PROFILE_TITLE}</DialogTitle>
            <DialogDescription>{PROFILE_DESCRIPTION}</DialogDescription>
          </DialogHeader>

          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
