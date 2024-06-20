import { Container } from '@/components/layout/Container';
import { MaintenanceAlert } from '@/components/presentational/MaintenanceAlert';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Alert } from '@/components/ui/v2/Alert';
import { Divider } from '@/components/ui/v2/Divider';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { OverviewDeployments } from '@/features/projects/overview/components/OverviewDeployments';
import { OverviewDocumentation } from '@/features/projects/overview/components/OverviewDocumentation';
import { OverviewMetrics } from '@/features/projects/overview/components/OverviewMetrics';
import { OverviewProjectHealth } from '@/features/projects/overview/components/OverviewProjectHealth';
import { OverviewProjectInfo } from '@/features/projects/overview/components/OverviewProjectInfo';
import { OverviewRepository } from '@/features/projects/overview/components/OverviewRepository';
import { OverviewTopBar } from '@/features/projects/overview/components/OverviewTopBar';
import { OverviewUsage } from '@/features/projects/overview/components/OverviewUsage';
import { features } from '@/features/projects/overview/features';
import { frameworks } from '@/features/projects/overview/frameworks';

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
        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

        <OverviewTopBar />

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
          <div className="order-2 grid grid-flow-row gap-12 lg:order-1 lg:col-span-2">
            <OverviewDocumentation
              title="Pick your favorite framework and start learning"
              description="Nhost integrates smoothly with all of the frameworks you already know."
              cardElements={frameworks}
            />

            <OverviewDocumentation
              title="Platform Documentation"
              description="More in-depth documentation for key features."
              cardElements={features}
            />
          </div>

          <div className="order-1 grid grid-flow-row content-start gap-8 lg:order-2 lg:col-span-1 lg:gap-12">
            <OverviewProjectInfo />
            <Divider />
            <OverviewUsage />
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <MaintenanceAlert />

      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

      <OverviewTopBar />

      <div className="grid grid-cols-1 gap-12 pt-3 lg:grid-cols-3">
        <div className="grid grid-flow-row gap-12 lg:col-span-2">
          <RetryableErrorBoundary>
            <OverviewMetrics />
          </RetryableErrorBoundary>

          <RetryableErrorBoundary>
            <OverviewDeployments />
          </RetryableErrorBoundary>

          <OverviewDocumentation
            title="Pick your favorite framework and start learning"
            description="Nhost integrates smoothly with all of the frameworks you already know."
            cardElements={frameworks}
            className="hidden lg:block"
          />

          <OverviewDocumentation
            title="Platform Documentation"
            description="More in-depth documentation for key features."
            cardElements={features}
            className="hidden lg:block"
          />
        </div>

        <div className="grid grid-flow-row content-start gap-8 lg:col-span-1 lg:gap-12">
          <OverviewProjectHealth />
          <Divider />
          <OverviewProjectInfo />
          <Divider />
          <OverviewRepository />
          <Divider />
          <OverviewUsage />
        </div>

        <OverviewDocumentation
          title="Pick your favorite framework and start learning"
          description="Nhost integrates smoothly with all of the frameworks you already know."
          cardElements={frameworks}
          className="lg:hidden"
        />

        <OverviewDocumentation
          title="Platform Documentation"
          description="More in-depth documentation for key features."
          cardElements={features}
          className="lg:hidden"
        />
      </div>
    </Container>
  );
}
