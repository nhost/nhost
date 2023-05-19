import MaintenanceAlert from '@/components/common/MaintenanceAlert';
import RetryableErrorBoundary from '@/components/common/RetryableErrorBoundary';
import Container from '@/components/layout/Container';
import OverviewDeployments from '@/components/overview/OverviewDeployments';
import OverviewDocumentation from '@/components/overview/OverviewDocumentation';
import OverviewMetrics from '@/components/overview/OverviewMetrics/OverviewMetrics';
import OverviewProjectInfo from '@/components/overview/OverviewProjectInfo';
import OverviewRepository from '@/components/overview/OverviewRepository';
import OverviewTopBar from '@/components/overview/OverviewTopBar';
import OverviewUsage from '@/components/overview/OverviewUsage';
import { features } from '@/components/overview/features';
import { frameworks } from '@/components/overview/frameworks';
import { useIsPlatform } from '@/features/projects/hooks/useIsPlatform';
import { Alert } from '@/ui/Alert';
import Divider from '@/ui/v2/Divider';

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
