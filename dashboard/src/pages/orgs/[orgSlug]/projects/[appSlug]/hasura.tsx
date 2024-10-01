import { Container } from '@/components/layout/Container';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { IconButton } from '@/components/ui/v2/IconButton';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { Text } from '@/components/ui/v2/Text';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import {
  defaultRemoteBackendSlugs,
  generateAppServiceUrl,
} from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { copy } from '@/utils/copy';
import { getHasuraConsoleServiceUrl } from '@/utils/env';
import Image from 'next/image';
import type { ReactElement } from 'react';

export default function HasuraPage() {
  const { project, loading } = useProject();
  const isPlatform = useIsPlatform();

  const { adminSecret: projectAdminSecret, settings } =
    project?.config?.hasura || {};

  if (loading || !projectAdminSecret) {
    return <LoadingScreen />;
  }

  const hasuraUrl =
    process.env.NEXT_PUBLIC_ENV === 'dev' || !isPlatform
      ? `${getHasuraConsoleServiceUrl()}`
      : generateAppServiceUrl(project?.subdomain, project?.region, 'hasura', {
          ...defaultRemoteBackendSlugs,
          hasura: '/console',
        });

  return (
    <Container>
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

          <Text variant="h3" component="h1" className="text-center">
            Open Hasura
          </Text>

          <Text className="text-center">
            Hasura is the dashboard you&apos;ll use to edit your schema and
            permissions as well as browse data. Copy the admin secret to your
            clipboard and enter it in the next screen.
          </Text>

          <Box className="mt-6 border-y-1">
            <div className="grid w-full grid-cols-1 place-content-between items-center py-2 sm:grid-cols-3">
              <Text className="col-span-1 text-center font-medium sm:justify-start sm:text-left">
                Admin Secret
              </Text>

              <div className="col-span-1 grid grid-flow-col items-center justify-center gap-2 sm:col-span-2 sm:justify-end">
                <Text className="font-medium" variant="subtitle2">
                  {Array(projectAdminSecret.length).fill('•').join('')}
                </Text>

                <IconButton
                  onClick={() =>
                    copy(projectAdminSecret, 'Hasura admin secret')
                  }
                  variant="borderless"
                  color="secondary"
                  className="min-w-0 p-1"
                  aria-label="Copy admin secret"
                >
                  <CopyIcon className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
          </Box>

          <div className="mt-6 grid grid-flow-row gap-2">
            <Button
              href={hasuraUrl}
              // Both `target` and `rel` are available when `href` is set. This is
              // a limitation of MUI.
              // @ts-ignore
              target="_blank"
              rel="noreferrer noopener"
              endIcon={<ArrowSquareOutIcon className="h-4 w-4" />}
              disabled={!settings?.enableConsole}
              variant={settings?.enableConsole ? 'contained' : 'outlined'}
              color={settings?.enableConsole ? 'primary' : 'secondary'}
            >
              Open Hasura
            </Button>
          </div>
        </div>
      </div>
    </Container>
  );
}

HasuraPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
