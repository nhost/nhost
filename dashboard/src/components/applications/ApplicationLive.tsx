import Container from '@/components/layout/Container';
import { features } from '@/components/overview/features';
import { frameworks } from '@/components/overview/frameworks';
import OverviewDeployments from '@/components/overview/OverviewDeployments';
import OverviewDocumentation from '@/components/overview/OverviewDocumentation';
import OverviewMigration from '@/components/overview/OverviewMigration';
import OverviewProjectInfo from '@/components/overview/OverviewProjectInfo';
import OverviewRepository from '@/components/overview/OverviewRepository';
import OverviewTopBar from '@/components/overview/OverviewTopBar';
import OverviewUsage from '@/components/overview/OverviewUsage';
import useIsPlatform from '@/hooks/common/useIsPlatform';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Divider from '@/ui/v2/Divider';

export default function ApplicationLive() {
  const isPlatform = useIsPlatform();
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const isProjectUsingRDS = currentApplication?.featureFlags.some(
    (feature) => feature.name === 'fleetcontrol_use_rds',
  );

  if (!isPlatform) {
    return (
      <Container>
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
      <OverviewTopBar />

      <div className="grid grid-cols-1 gap-12 pt-3 lg:grid-cols-3">
        <div className="order-2 grid grid-flow-row gap-12 lg:order-1 lg:col-span-2">
          <OverviewDeployments />

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
          {isProjectUsingRDS && (
            <>
              <OverviewMigration />
              <Divider />
            </>
          )}
          <OverviewProjectInfo />
          <Divider />
          <OverviewRepository />
          <Divider />
          <OverviewUsage />
        </div>
      </div>
    </Container>
  );
}
