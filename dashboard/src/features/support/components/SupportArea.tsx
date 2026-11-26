import { ChevronRight } from 'lucide-react';
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
    <div key={user.id} className="mx-auto flex w-full max-w-7xl grow flex-col">
      {children}
    </div>
  );
}

export function getSupportLayout(page: ReactElement) {
  return (
    <StandaloneLayout hideHeaderNavigation>
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

export function SupportBreadcrumb({
  currentPage,
  isTicketList = false,
}: {
  currentPage: string;
  isTicketList?: boolean;
}) {
  const linkClassName =
    'rounded-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        <li className="shrink-0">
          <Link href="/support" className={linkClassName}>
            Support
          </Link>
        </li>
        <li aria-hidden="true" className="shrink-0">
          <ChevronRight className="size-3.5 text-muted-foreground" />
        </li>
        {!isTicketList && (
          <>
            <li className="shrink-0">
              <Link href="/support/tickets" className={linkClassName}>
                All tickets
              </Link>
            </li>
            <li aria-hidden="true" className="shrink-0">
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </li>
          </>
        )}
        <li aria-current="page" className="min-w-0 truncate text-foreground">
          {currentPage}
        </li>
      </ol>
    </nav>
  );
}
