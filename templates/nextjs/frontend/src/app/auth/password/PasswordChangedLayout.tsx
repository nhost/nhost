'use client';

import { type ReactNode, useState } from 'react';
import PasswordChanged, {
  PasswordChangedContext,
} from '@/app/auth/password/PasswordChanged';

// A password change revokes every session the account has, so whoever held the
// old password or a stolen refresh token is cut off, and the action deletes
// this one's cookies too. Next answers that by rendering the page again with
// no session: the dead-link card on the reset page, a redirect to sign-in on
// the change page. So knowing the change worked has to live in a client
// component that render does not replace. One wrapping the page's cards would
// do; a layout does it without the page having to arrange for it. It keeps its
// state while the page under it is replaced, and the router hands the form the
// action's result before it shows that render, so by then this is showing the
// card and not the page. That is also what stops the change page's redirect:
// a redirect thrown while a page renders only navigates once that page is
// rendered, and the card has taken its place.
export default function PasswordChangedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [changed, setChanged] = useState(false);

  if (changed) {
    return <PasswordChanged />;
  }

  return (
    <PasswordChangedContext value={() => setChanged(true)}>
      {children}
    </PasswordChangedContext>
  );
}
