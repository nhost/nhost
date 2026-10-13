'use client';

import { type ReactNode, useState } from 'react';
import PasswordChanged, {
  PasswordChangedContext,
} from '@/app/auth/password/reset/PasswordChanged';

// A password change revokes every session the account has, so whoever held the
// old password or a stolen refresh token is cut off, and the action deletes
// this one's cookies too. Next answers that by rendering the page again with
// no session, which is the dead-link card, so knowing the change worked has to
// live in a client component that render does not replace. One wrapping both
// of the page's cards would do; this layout does it without the page having to
// arrange for it. It keeps its state while the page under it is replaced, and
// the router hands the form the action's result before it shows that render.
export default function ResetPasswordLayout({
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
