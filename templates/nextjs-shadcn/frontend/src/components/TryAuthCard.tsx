import type { NhostClient } from '@nhost/nhost-js';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type UserSession = ReturnType<NhostClient['getUserSession']>;

// Auth-aware card on the home page: a sign-in call to action when signed out,
// and the current user plus a sign-out button when signed in.
export function TryAuthCard({ session }: { session: UserSession }) {
  if (!session) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>1. Try authentication</CardTitle>
          <CardDescription>
            Sign in with an email one-time code. While running locally, the
            email with the code is captured by the local mail viewer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/signin">Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>You are signed in ✓</CardTitle>
        <CardDescription>
          Your session is available to both server components and the browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Email: </span>
          {session.user?.email ?? 'Not available'}
        </div>
        <div>
          <span className="text-muted-foreground">User ID: </span>
          {session.user?.id ?? 'Not available'}
        </div>
        <SignOutButton />
      </CardContent>
    </Card>
  );
}
