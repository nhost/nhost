import Link from 'next/link';
import type { PropsWithChildren, ReactElement } from 'react';
import { StandaloneLayout } from '@/components/layout/StandaloneLayout';
import { Button } from '@/components/ui/v3/button';
import { AuthGuard } from '@/features/orgs/guards/AuthGuard';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useAuth } from '@/providers/Auth';

export function SupportArea({ children }: PropsWithChildren) {
  const isPlatform = useIsPlatform();
  const { user } = useAuth();
  if (!isPlatform || !user) {
    return (
      <div className="p-8">
        <h1 className="font-semibold text-xl">Nhost Support</h1>
        <p className="mt-2 text-muted-foreground">
          Sign in to the Nhost platform to access support tickets.
        </p>
      </div>
    );
  }
  return (
    <div key={user.id} className="mx-auto w-full max-w-7xl">
      {children}
    </div>
  );
}

export function getSupportLayout(page: ReactElement) {
  return (
    <StandaloneLayout>
      <AuthGuard>
        <SupportArea>{page}</SupportArea>
      </AuthGuard>
    </StandaloneLayout>
  );
}

export function SupportError({
  message,
  retry,
}: {
  message: string;
  retry?: VoidFunction;
}) {
  return (
    <div role="alert" className="rounded-md border p-5">
      <p>{message}</p>
      {retry && (
        <Button variant="outline" className="mt-3" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function SupportBackLink() {
  return (
    <Link
      href="/support"
      className="text-muted-foreground text-sm hover:text-foreground"
    >
      ← All tickets
    </Link>
  );
}
