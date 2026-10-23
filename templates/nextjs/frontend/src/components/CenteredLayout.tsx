import type { ReactNode } from 'react';

/**
 * Centres a page's single card in the space under the nav, for the sign-in
 * list, every method's page and the home page. Left at the top of a tall
 * window the card looked like the start of a page with nothing after it.
 *
 * The height is the viewport less the nav (57px), a one-row footer (53px) and
 * `main`'s vertical padding (80px), so a short card never makes the page
 * scroll and sits at the true middle of the space between nav and footer.
 *
 * The pages are wrapped in a plain block before the flex column sees them.
 * As flex items themselves, their `mx-auto` shrank each card to its content
 * instead of letting it fill `max-w-sm`.
 */
export default function CenteredLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100svh-11.875rem)] flex-col justify-center">
      <div>{children}</div>
    </div>
  );
}
