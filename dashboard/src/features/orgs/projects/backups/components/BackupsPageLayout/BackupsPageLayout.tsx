import type { ReactNode } from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Container } from '@/components/layout/Container';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Spinner } from '@/components/ui/v3/spinner';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';

export interface BackupsPageLayoutProps {
  children: ReactNode;
}

export default function BackupsPageLayout({
  children,
}: BackupsPageLayoutProps) {
  const { currentOrg: org, loading } = useOrgs();

  if (loading) {
    return <Spinner>Loading...</Spinner>;
  }

  const isPlanFree = org!.plan.isFree;

  if (isPlanFree) {
    return (
      <Container
        className="grid grid-flow-row gap-6 bg-transparent"
        rootClassName="bg-transparent"
      >
        <UpgradeToProBanner
          section="backups"
          title="To unlock Database Backups, transfer this project to a Pro or Team organization."
          description=""
        />
      </Container>
    );
  }

  return (
    <Container className="grid max-w-5xl grid-flow-row gap-y-6 bg-transparent">
      <RetryableErrorBoundary>{children}</RetryableErrorBoundary>
    </Container>
  );
}
