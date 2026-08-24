import { ExternalLink as ArrowSquareOutIcon, CopyIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Container } from '@/components/layout/Container';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Button } from '@/components/ui/v3/button';
import { Separator } from '@/components/ui/v3/separator';
import { Spinner } from '@/components/ui/v3/spinner';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { copy } from '@/utils/copy';

export default function MetricsPage() {
  return (
    <RetryableErrorBoundary>
      <MetricsPageContent />
    </RetryableErrorBoundary>
  );
}

function MetricsPageContent() {
  const { org, loading: loadingOrg, error: orgError } = useCurrentOrg();
  const {
    project,
    loading: loadingProject,
    error: projectError,
  } = useProject();

  const adminPassword = project?.config?.observability?.grafana?.adminPassword;

  if (loadingOrg || loadingProject) {
    return (
      <Container>
        <Spinner size="medium" wrapperClassName="gap-2">
          Loading project...
        </Spinner>
      </Container>
    );
  }

  if (org?.plan?.isFree) {
    return (
      <Container
        className="grid grid-flow-row gap-6 bg-transparent"
        rootClassName="bg-transparent"
      >
        <UpgradeToProBanner
          section="metrics"
          title="To unlock Grafana Metrics & Alerts, transfer this project to a Pro or Team organization."
          description=""
        />
      </Container>
    );
  }

  if (orgError) {
    throw orgError;
  }

  if (projectError) {
    throw projectError;
  }

  return (
    <Container>
      <div className="mx-auto w-full max-w-md px-6 py-4 text-left">
        <div className="grid grid-flow-row gap-1">
          <div className="mx-auto">
            <Image
              src="/assets/grafana.svg"
              width={72}
              height={72}
              alt="Grafana"
            />
          </div>

          <h1 className="text-center font-medium text-lg">Open Grafana</h1>

          <p className="text-center text-sm">
            Grafana is the observability dashboard for your project. Here you
            will be able to see various metrics about its usage and performance.
            Copy the admin password to your clipboard and enter it in the next
            screen.
          </p>

          <div className="mt-6 grid grid-flow-row gap-0 border-y-1">
            <div className="grid w-full grid-cols-1 place-content-between items-center py-2 sm:grid-cols-3">
              <p className="col-span-1 text-center font-medium sm:justify-start sm:text-left">
                Username
              </p>

              <div className="col-span-1 grid grid-flow-col items-center justify-center gap-2 sm:col-span-2 sm:justify-end">
                <p className="text-muted-foreground text-sm">admin</p>
              </div>
            </div>

            <Separator />

            <div className="grid w-full grid-cols-1 place-content-between items-center py-2 sm:grid-cols-3">
              <p className="col-span-1 text-center font-medium sm:justify-start sm:text-left">
                Password
              </p>

              <div className="col-span-1 grid grid-flow-col items-center justify-center gap-2 sm:col-span-2 sm:justify-end">
                <p className="font-medium text-muted-foreground text-xs">
                  {adminPassword
                    ? Array(adminPassword.length).fill('•').join('')
                    : 'N/A'}
                </p>

                {adminPassword && (
                  <Button
                    onClick={() => copy(adminPassword, 'Grafana password')}
                    variant="ghost"
                    size="icon"
                    aria-label="Copy password"
                  >
                    <CopyIcon className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-flow-row gap-2">
            <Button asChild>
              <Link
                href={generateAppServiceUrl(
                  project!.subdomain,
                  project!.region,
                  'grafana',
                )}
                target="_blank"
                rel="noreferrer noopener"
              >
                Open Grafana
                <ArrowSquareOutIcon className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Container>
  );
}

MetricsPage.getLayout = function getLayout(page: ReactElement) {
  return <OrgLayout>{page}</OrgLayout>;
};
