import type { ComponentProps } from 'react';
import { NhostLogo } from '@/components/dev-toolbar/NhostLogo';
import { cn } from '@/lib/utils';

/**
 * The three marks the nav wears instead of a name.
 *
 * All drawn in `currentColor` so the row stays monochrome and follows the
 * theme. Each is `aria-hidden` because the link around them carries the
 * label: three logo titles read out in a row is noise, not information.
 */
export function NhostMark({ className }: { className?: string }) {
  // The same folded-N ribbon the dev toolbar draws, imported rather than
  // copied so the two cannot drift apart. It carries its own "Nhost" label for
  // the toolbar's sake, so the wrapper hides the whole subtree instead;
  // `contents` keeps the span out of the layout.
  return (
    <span aria-hidden="true" className="contents">
      <NhostLogo className={cn('size-5', className)} />
    </span>
  );
}

export function NextMark({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn('size-5', className)}
      {...props}
    >
      <path d="M18.665 21.978C16.758 23.255 14.465 24 12 24 5.377 24 0 18.623 0 12S5.377 0 12 0s12 5.377 12 12c0 3.583-1.574 6.801-4.067 9.001L9.219 7.2H7.2v9.596h1.615V9.251l9.85 12.727Zm-3.332-8.533 1.6 2.061V7.2h-1.6v6.245Z" />
    </svg>
  );
}

export function ShadcnMark({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn('size-5', className)}
      {...props}
    >
      <path d="M22.219 11.784 11.784 22.219c-.407.407-.407 1.068 0 1.476.407.407 1.068.407 1.476 0L23.695 13.26c.407-.408.407-1.069 0-1.476-.408-.407-1.069-.407-1.476 0ZM20.132.305.305 20.132c-.407.407-.407 1.068 0 1.476.408.407 1.069.407 1.476 0L21.608 1.781c.407-.407.407-1.068 0-1.476-.408-.407-1.069-.407-1.476 0Z" />
    </svg>
  );
}
