import { ExternalLink as ArrowSquareOutIcon, CopyIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Button } from '@/components/ui/v3/button';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import {
  defaultRemoteBackendSlugs,
  generateAppServiceUrl,
} from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { copy } from '@/utils/copy';
import { getHasuraConsoleServiceUrl } from '@/utils/env';

export default function HasuraPage() {
  return (
    <RetryableErrorBoundary>
      <HasuraPageContent />
    </RetryableErrorBoundary>
  );
}

function HasuraPageContent() {
  const { project, loading, error } = useProject();
  const isPlatform = useIsPlatform();

  if (error) {
    throw error;
  }

  const { adminSecret: projectAdminSecret, settings } =
    project?.config?.hasura || {};

  if (loading || !projectAdminSecret) {
    return <LoadingScreen />;
  }

  const hasuraUrl =
    process.env.NEXT_PUBLIC_ENV === 'dev' || !isPlatform
      ? `${getHasuraConsoleServiceUrl()}`
      : generateAppServiceUrl(project!.subdomain, project!.region, 'hasura', {
          ...defaultRemoteBackendSlugs,
          hasura: '/console',
        });

  return (
    <div className="mx-auto w-full max-w-md px-6 py-4 text-left">
      <div className="grid grid-flow-row gap-1">
        <div className="mx-auto">
          <Image
            src="/assets/hasuramodal.svg"
            width={72}
            height={72}
            alt="Hasura"
          />
        </div>

        <h1 className="text-center font-medium text-lg">Open Hasura</h1>

        <p className="text-center text-sm+">
          Hasura is the dashboard you&apos;ll use to edit your schema and
          permissions as well as browse data. Copy the admin secret to your
          clipboard and enter it in the next screen.
        </p>

        <div className="box mt-6 border-y-1">
          <div className="grid w-full grid-cols-1 place-content-between items-center py-2 sm:grid-cols-3">
            <p className="col-span-1 text-center font-medium text-sm+ sm:justify-start sm:text-left">
              Admin Secret
            </p>

            <div className="col-span-1 grid grid-flow-col items-center justify-center gap-2 sm:col-span-2 sm:justify-end">
              <span className="font-medium text-muted-foreground text-xs">
                {Array(projectAdminSecret.length).fill('•').join('')}
              </span>

              <Button
                onClick={() => copy(projectAdminSecret, 'Hasura admin secret')}
                variant="ghost"
                size="icon"
                aria-label="Copy admin secret"
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-flow-row gap-2">
          {settings?.enableConsole ? (
            <Button asChild>
              <Link href={hasuraUrl} target="_blank" rel="noreferrer noopener">
                Open Hasura
                <ArrowSquareOutIcon className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Open Hasura
              <ArrowSquareOutIcon className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

HasuraPage.getLayout = function getLayout(page: ReactElement) {
  return <OrgLayout>{page}</OrgLayout>;
};
