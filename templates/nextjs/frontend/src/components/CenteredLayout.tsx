import type { ReactNode } from 'react';

/**
 * Centres a page's single card in the space under the nav, for the sign-in
 * list, every method's page and the home page.
 */
export default function CenteredLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100svh-11.875rem)] flex-col justify-center">
      <div>{children}</div>
    </div>
  );
}
