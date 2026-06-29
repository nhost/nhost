import type { ReactElement } from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Container } from '@/components/layout/Container';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Spinner } from '@/components/ui/v3/spinner';
import { useIsPiTREnabled } from '@/features/orgs/hooks/useIsPiTREnabled';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { BackupsContent } from '@/features/orgs/projects/backups/components/BackupsContent';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';

export default function BackupsPage() {
  const { currentOrg: org, loading } = useOrgs();
  const { isPiTREnabled, loading: isPiTREnabledLoading } = useIsPiTREnabled();

  if (loading || isPiTREnabledLoading) {
    return <Spinner delay={1000}>Loading project...</Spinner>;
  }

  const isPlanFree = org!.plan.isFree;

  if (isPlanFree) {
    return (
      <Container
        className="grid grid-flow-row gap-6 bg-transparent"
        rootClassName="bg-transparent"
      >
        <UpgradeToProBanner
          title="To unlock Database Backups, transfer this project to a Pro or Team organization."
          description=""
        />
      </Container>
    );
  }

  return (
    <Container className="grid max-w-5xl grid-flow-row gap-y-6 bg-transparent">
      <div className="grid grid-flow-col justify-between gap-2">
        <h1 className="font-medium text-2xl">Backups</h1>
      </div>

      <RetryableErrorBoundary>
        <BackupsContent isPiTREnabled={isPiTREnabled} />
      </RetryableErrorBoundary>
    </Container>
  );
}

BackupsPage.getLayout = function getLayout(page: ReactElement) {
  return <OrgLayout>{page}</OrgLayout>;
};
