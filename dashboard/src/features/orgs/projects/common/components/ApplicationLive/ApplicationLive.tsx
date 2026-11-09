import { Container } from '@/components/layout/Container';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { OverviewConnect } from '@/features/orgs/projects/overview/components/OverviewConnect';
import { OverviewDeployments } from '@/features/orgs/projects/overview/components/OverviewDeployments';
import { OverviewDocumentation } from '@/features/orgs/projects/overview/components/OverviewDocumentation';
import { OverviewMetrics } from '@/features/orgs/projects/overview/components/OverviewMetrics';
import { OverviewProjectInfo } from '@/features/orgs/projects/overview/components/OverviewProjectInfo';
import { OverviewRepository } from '@/features/orgs/projects/overview/components/OverviewRepository';
import { OverviewServices } from '@/features/orgs/projects/overview/components/OverviewServices';
import { OverviewTopBar } from '@/features/orgs/projects/overview/components/OverviewTopBar';

export interface ApplicationLiveProps {
  /**
   * Error message to display in the alert.
   */
  errorMessage?: string;
}

export default function ApplicationLive({
  errorMessage,
}: ApplicationLiveProps) {
  const isPlatform = useIsPlatform();

  if (!isPlatform) {
    return (
      <Container>
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <OverviewTopBar />

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <OverviewDocumentation className="order-2 lg:order-1 lg:col-span-2" />

          <div className="order-1 flex flex-col gap-10 lg:order-2">
            <OverviewProjectInfo />
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <OverviewTopBar />

      <div className="grid grid-cols-1 gap-10 pt-3 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-10 lg:col-span-2">
          <RetryableErrorBoundary>
            <OverviewMetrics />
          </RetryableErrorBoundary>

          <RetryableErrorBoundary>
            <OverviewDeployments />
          </RetryableErrorBoundary>

          <OverviewDocumentation className="hidden lg:flex" />
        </div>

        <div className="flex min-w-0 flex-col gap-10">
          <RetryableErrorBoundary>
            <OverviewServices />
          </RetryableErrorBoundary>
          <OverviewConnect />
          <OverviewRepository />
        </div>

        <OverviewDocumentation className="lg:hidden" />
      </div>
    </Container>
  );
}
