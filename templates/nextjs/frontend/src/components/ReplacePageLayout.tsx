'use client';

import { createContext, type ReactNode, use, useState } from 'react';

const ReplacePageContext = createContext<(page: ReactNode) => void>(() => {
  throw new Error('This has to render inside ReplacePageLayout.');
});

/**
 * What a form calls to put something in place of the page it is on, such as the
 * card that says a password change worked.
 */
export function useReplacePage(): (page: ReactNode) => void {
  return use(ReplacePageContext);
}

// A password change revokes every session the account has, so whoever held the
// old password or a stolen refresh token is cut off, and the action deletes
// this one's cookies too.
export default function ReplacePageLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Wrapped, because a page that is itself a function component would be
  // taken by setState for an updater and called.
  const [replaced, setReplaced] = useState<{ page: ReactNode } | undefined>();

  if (replaced) {
    return replaced.page;
  }

  return (
    <ReplacePageContext value={(page) => setReplaced({ page })}>
      {children}
    </ReplacePageContext>
  );
}
