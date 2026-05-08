import { Container } from '@/components/layout/Container';
import { Alert } from '@/components/ui/v2/Alert';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { OverviewDocumentation } from '@/features/orgs/projects/overview/components/OverviewDocumentation';
import { OverviewProjectInfo } from '@/features/orgs/projects/overview/components/OverviewProjectInfo';
import { OverviewTopBar } from '@/features/orgs/projects/overview/components/OverviewTopBar';
import { OverviewDashboard } from '@/features/orgs/projects/overview/dashboard';
import { features } from '@/features/orgs/projects/overview/features';
import { frameworks } from '@/features/orgs/projects/overview/frameworks';

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
          </div>
        </div>
      </Container>
    );
  }

  return (
    <>
      {errorMessage && (
        <Container>
          <Alert severity="error">{errorMessage}</Alert>
        </Container>
      )}
      <OverviewDashboard />
    </>
  );
}
