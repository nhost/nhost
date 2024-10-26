import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { IconButton } from '@/components/ui/v2/IconButton';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { Text } from '@/components/ui/v2/Text';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { copy } from '@/utils/copy';
import Image from 'next/image';
import type { ReactElement } from 'react';

export default function MetricsPage() {
  const { org, loading: loadingOrg } = useCurrentOrg();
  const { project, loading: loadingProject } = useProject();

  const adminPassword = project?.config?.observability?.grafana?.adminPassword;

  if (loadingOrg || loadingProject) {
    return (
      <Container>
        <ActivityIndicator label="Loading project..." delay={1000} />
      </Container>
    );
  }

  if (org.plan.isFree) {
    return (
      <Container
        className="grid grid-flow-row gap-6 bg-transparent"
        rootClassName="bg-transparent"
      >
        <UpgradeToProBanner
          title="To unlock Grafana Metrics & Alerts, transfer this project to a Pro or Team organization."
          description=""
        />
      </Container>
    );
  }

  return (
    <Container>
      <div className="w-full max-w-md px-6 py-4 mx-auto text-left">
        <div className="grid grid-flow-row gap-1">
          <div className="mx-auto">
            <Image
              src="/assets/grafana.svg"
              width={72}
              height={72}
              alt="Grafana"
            />
          </div>

          <Text variant="h3" component="h1" className="text-center">
            Open Grafana
          </Text>

          <Text className="text-center">
            Grafana is the observability dashboard for your project. Here you
            will be able to see various metrics about its usage and performance.
            Copy the admin password to your clipboard and enter it in the next
            screen.
          </Text>

          <Box className="grid grid-flow-row gap-0 mt-6 border-y-1">
            <div className="grid items-center w-full grid-cols-1 py-2 place-content-between sm:grid-cols-3">
              <Text className="col-span-1 font-medium text-center sm:justify-start sm:text-left">
                Username
              </Text>

              <div className="grid items-center justify-center grid-flow-col col-span-1 gap-2 sm:col-span-2 sm:justify-end">
                <Text color="secondary" className="text-sm">
                  admin
                </Text>
              </div>
            </div>

            <Divider />

            <div className="grid items-center w-full grid-cols-1 py-2 place-content-between sm:grid-cols-3">
              <Text className="col-span-1 font-medium text-center sm:justify-start sm:text-left">
                Password
              </Text>

              <div className="grid items-center justify-center grid-flow-col col-span-1 gap-2 sm:col-span-2 sm:justify-end">
                <Text className="font-medium" variant="subtitle2">
                  {adminPassword
                    ? Array(adminPassword.length).fill('•').join('')
                    : 'N/A'}
                </Text>

                {adminPassword && (
                  <IconButton
                    onClick={() => copy(adminPassword, 'Grafana password')}
                    variant="borderless"
                    color="secondary"
                    className="min-w-0 p-1"
                    aria-label="Copy password"
                  >
                    <CopyIcon className="w-4 h-4" />
                  </IconButton>
                )}
              </div>
            </div>
          </Box>

          <div className="grid grid-flow-row gap-2 mt-6">
            <Button
              href={generateAppServiceUrl(
                project.subdomain,
                project.region,
                'grafana',
              )}
              // Both `target` and `rel` are available when `href` is set. This is
              // a limitation of MUI.
              // @ts-ignore
              target="_blank"
              rel="noreferrer noopener"
              endIcon={<ArrowSquareOutIcon className="w-4 h-4" />}
            >
              Open Grafana
            </Button>
          </div>
        </div>
      </div>
    </Container>
  );
}

MetricsPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
