import type { ReactNode } from 'react';

/**
 * Centres a page's single card in the space under the nav, for the sign-in
 * list and every method's page. Left at the top of a tall window the card
 * looked like the start of a page with nothing after it.
 *
 * The height is the viewport less the nav and `main`'s vertical padding, so
 * a short card never makes the page scroll. A little more room below than
 * above sits it just over the middle, where a centred thing reads as centred.
 *
 * The pages are wrapped in a plain block before the flex column sees them.
 * As flex items themselves, their `mx-auto` shrank each card to its content
 * instead of letting it fill `max-w-sm`.
 */
export default function CenteredLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100svh-9rem)] flex-col justify-center pb-[6vh]">
      <div>{children}</div>
    </div>
  );
}
