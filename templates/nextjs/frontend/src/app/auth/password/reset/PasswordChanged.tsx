'use client';

import Link from 'next/link';
import { createContext } from 'react';
import { passwordSignIn } from '@/app/auth/password/reset/passwordSignIn';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/** What the reset form calls once the server has accepted the new password. */
export const PasswordChangedContext = createContext<() => void>(() => {
  throw new Error('The reset form has to render inside the reset layout.');
});

export default function PasswordChanged() {
  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Password changed</CardTitle>
          <CardDescription>
            Changing it signed you out everywhere, this browser included. Sign
            in again with the new password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={passwordSignIn}>Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
