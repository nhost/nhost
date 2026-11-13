'use client';

import Link from 'next/link';
import { passwordSignIn } from '@/app/auth/password/passwordSignIn';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function PasswordChanged() {
  return (
    <div className="mx-auto max-w-sm">
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
