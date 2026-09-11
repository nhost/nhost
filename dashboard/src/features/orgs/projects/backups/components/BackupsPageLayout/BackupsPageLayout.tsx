import { DatabaseIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { UpgradeBanner } from '@/components/common/UpgradeBanner';
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
        className="grid grid-flow-row gap-6 bg-transparent pt-0"
        rootClassName="bg-transparent"
      >
        <UpgradeBanner section="backups" icon={DatabaseIcon} />
      </Container>
    );
  }

  return (
    <Container className="grid max-w-5xl grid-flow-row gap-y-6 bg-transparent pt-0">
      <RetryableErrorBoundary>{children}</RetryableErrorBoundary>
    </Container>
  );
}
