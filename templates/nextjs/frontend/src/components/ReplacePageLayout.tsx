'use client';

import { createContext, type ReactNode, use, useState } from 'react';

const ReplacePageContext = createContext<(page: ReactNode) => void>(() => {
  throw new Error('This has to render inside ReplacePageLayout.');
});

/**
 * What a form calls to put something in place of the page it is on, such as
 * the card that says a password change worked.
 */
export function useReplacePage(): (page: ReactNode) => void {
  return use(ReplacePageContext);
}

// A password change revokes every session the account has, so whoever held the
// old password or a stolen refresh token is cut off, and the action deletes
// this one's cookies too. Next answers that by rendering the page again with
// no session: the dead-link card on the reset page, a redirect to sign-in on
// the account page. So knowing the change worked has to live in a client
// component that render does not replace. A layout is one: it keeps its state
// while the page under it is replaced, and the router hands the form the
// action's result before it shows that render, so by then this is showing what
// the form asked for and not the page. That is also what stops the account
// page's redirect: a redirect thrown while a page renders only navigates once
// that page is rendered, and something else has taken its place.
//
// It lives here, not with the password method, because the account page is
// shared code and its layout cannot import a method. The method imports this
// instead, and says what to show.
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
