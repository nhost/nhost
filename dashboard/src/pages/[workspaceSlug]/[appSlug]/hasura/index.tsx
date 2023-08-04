import { Container } from '@/components/layout/Container';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import { InlineCode } from '@/components/presentational/InlineCode';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { IconButton } from '@/components/ui/v2/IconButton';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import {
  defaultLocalBackendSlugs,
  defaultRemoteBackendSlugs,
  generateAppServiceUrl,
} from '@/features/projects/common/utils/generateAppServiceUrl';
import { copy } from '@/utils/copy';
import { getHasuraConsoleServiceUrl } from '@/utils/env';
import Image from 'next/image';
import type { ReactElement } from 'react';

export default function HasuraPage() {
  const {
    currentProject,
    currentWorkspace,
    loading: currentProjectLoading,
  } = useCurrentWorkspaceAndProject();

  const isPlatform = useIsPlatform();

  const { adminSecret: projectAdminSecret, settings } =
    currentProject?.config?.hasura || {};

  if (currentProjectLoading || !projectAdminSecret) {
    return <LoadingScreen />;
  }

  const hasSecretsEnabled =
    /\{\{\s*secrets\.[A-Za-z_][A-Za-z0-9_]*\s*\}\}/.test(projectAdminSecret);

  const hasuraUrl =
    process.env.NEXT_PUBLIC_ENV === 'dev' || !isPlatform
      ? `${getHasuraConsoleServiceUrl()}`
      : generateAppServiceUrl(
          currentProject?.subdomain,
          currentProject?.region,
          'hasura',
          defaultLocalBackendSlugs,
          { ...defaultRemoteBackendSlugs, hasura: '/console' },
        );

  return (
    <Container>
      <div className="w-full max-w-md px-6 py-4 mx-auto text-left">
        <div className="grid grid-flow-row gap-1">
          <div className="mx-auto">
            <Image
              src="/assets/hasuramodal.svg"
              width={72}
              height={72}
              alt="Hasura"
            />
          </div>

          {!hasSecretsEnabled ? (
            <>
              <Text variant="h3" component="h1" className="text-center">
                Open Hasura
              </Text>

              <Text className="text-center">
                Hasura is the dashboard you&apos;ll use to edit your schema and
                permissions as well as browse data. Copy the admin secret to
                your clipboard and enter it in the next screen.
              </Text>

              <Box className="mt-6 border-y-1">
                <div className="grid items-center w-full grid-cols-1 py-2 place-content-between sm:grid-cols-3">
                  <Text className="col-span-1 font-medium text-center sm:justify-start sm:text-left">
                    Admin Secret
                  </Text>

                  <div className="grid items-center justify-center grid-flow-col col-span-1 gap-2 sm:col-span-2 sm:justify-end">
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
                      <CopyIcon className="w-4 h-4" />
                    </IconButton>
                  </div>
                </div>
              </Box>

              <div className="grid grid-flow-row gap-2 mt-6">
                <Button
                  href={hasuraUrl}
                  // Both `target` and `rel` are available when `href` is set. This is
                  // a limitation of MUI.
                  // @ts-ignore
                  target="_blank"
                  rel="noreferrer noopener"
                  endIcon={<ArrowSquareOutIcon className="w-4 h-4" />}
                  disabled={!settings?.enableConsole}
                  variant={settings?.enableConsole ? 'contained' : 'outlined'}
                  color={settings?.enableConsole ? 'primary' : 'secondary'}
                >
                  Open Hasura
                </Button>
              </div>
            </>
          ) : (
            <>
              <Text className="text-center">
                The password is set by the secret{' '}
                <InlineCode className="text-xs">{`{{ secrets.HASURA_GRAPHQL_ADMIN_SECRET }}`}</InlineCode>{' '}
                and you can change it in the secrets page
              </Text>

              <div className="grid grid-flow-row gap-2 mt-6">
                <Button
                  href={hasuraUrl}
                  // Both `target` and `rel` are available when `href` is set. This is
                  // a limitation of MUI.
                  // @ts-ignore
                  target="_blank"
                  rel="noreferrer noopener"
                  endIcon={<ArrowSquareOutIcon className="w-4 h-4" />}
                  disabled={!settings?.enableConsole}
                  variant={settings?.enableConsole ? 'contained' : 'outlined'}
                  color="primary"
                >
                  Open Hasura
                </Button>

                <Button
                  href={`/${currentWorkspace.slug}/${currentProject.slug}/settings/secrets`}
                  endIcon={<ArrowSquareOutIcon className="w-4 h-4" />}
                  variant="outlined"
                  color="secondary"
                >
                  Go to secrets
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Container>
  );
}

HasuraPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
