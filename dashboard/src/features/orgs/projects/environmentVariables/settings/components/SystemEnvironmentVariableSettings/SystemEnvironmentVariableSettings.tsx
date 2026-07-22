import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import { InlineCode } from '@/components/presentational/InlineCode';

import { Button } from '@/components/ui/v3/button';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import {
  defaultRemoteBackendSlugs,
  generateAppServiceUrl,
} from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { EditJwtSecretForm } from '@/features/orgs/projects/environmentVariables/settings/components/EditJwtSecretForm';
import { getJwtSecretsWithoutFalsyValues } from '@/features/orgs/projects/environmentVariables/settings/utils/getJwtSecretsWithoutFalsyValues';
import { useAppClient } from '@/features/orgs/projects/hooks/useAppClient';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetEnvironmentVariablesQuery } from '@/generated/graphql';
import { getHasuraConsoleServiceUrl } from '@/utils/env';

export default function SystemEnvironmentVariableSettings() {
  const appClient = useAppClient();
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { openDialog } = useDialog();
  const localMimirClient = useLocalMimirClient();
  const [showAdminSecret, setShowAdminSecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const { data, error } = useGetEnvironmentVariablesQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { jwtSecrets, webhookSecret, adminSecret } = data?.config?.hasura || {};
  const jwtSecretsWithoutFalsyValues = getJwtSecretsWithoutFalsyValues(
    jwtSecrets || [],
  );
  const stringifiedJwtSecrets =
    jwtSecretsWithoutFalsyValues.length === 1
      ? JSON.stringify(jwtSecretsWithoutFalsyValues[0], null, 2)
      : JSON.stringify(jwtSecretsWithoutFalsyValues, null, 2);

  if (error) {
    throw error;
  }

  function showViewJwtSecretModal() {
    openDialog({
      title: (
        <span className="grid grid-flow-row">
          <span>Auth JWT Secret</span>

          <p className="text-muted-foreground text-sm">
            This is the key used for generating JWTs. It&apos;s the same as
            configured in Hasura.
          </p>
        </span>
      ),
      component: (
        <EditJwtSecretForm disabled jwtSecret={stringifiedJwtSecrets} />
      ),
    });
  }

  const systemEnvironmentVariables = [
    { key: 'NHOST_SUBDOMAIN', value: project!.subdomain },
    { key: 'NHOST_REGION', value: project!.region.name },
    {
      key: 'NHOST_HASURA_URL',
      value:
        process.env.NEXT_PUBLIC_ENV === 'dev' || !isPlatform
          ? `${getHasuraConsoleServiceUrl()}/console`
          : generateAppServiceUrl(
              project!.subdomain,
              project!.region,
              'hasura',
              { ...defaultRemoteBackendSlugs, hasura: '/console' },
            ),
    },
    { key: 'NHOST_AUTH_URL', value: appClient.auth.baseURL },
    { key: 'NHOST_GRAPHQL_URL', value: appClient.graphql.url },
    { key: 'NHOST_STORAGE_URL', value: appClient.storage.baseURL },
    {
      key: 'NHOST_FUNCTIONS_URL',
      value: appClient.functions.baseURL,
    },
  ];

  return (
    <SettingsCard className="gap-0">
      <SettingsCardHeader
        title="System Environment Variables"
        description="System environment variables are automatically generated from the configuration file and your project's subdomain and region."
      />

      <SettingsCardContent className="mt-2 mb-2.5 px-0">
        <div className="grid grid-cols-3 gap-2 border-b-1 px-4 py-3">
          <p className="font-medium">Variable Name</p>
          <p className="font-medium lg:col-span-2">Value</p>
        </div>

        <div>
          <div className="grid grid-cols-2 gap-2 px-4 lg:grid-cols-3">
            <p>NHOST_ADMIN_SECRET</p>

            <div className="grid grid-flow-col items-center justify-start gap-2 lg:col-span-2">
              <p className="truncate">
                {showAdminSecret ? (
                  <InlineCode className="!text-sm font-medium">
                    {adminSecret}
                  </InlineCode>
                ) : (
                  '●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●'
                )}
              </p>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={
                  showAdminSecret ? 'Hide Admin Secret' : 'Show Admin Secret'
                }
                onClick={() => setShowAdminSecret((show) => !show)}
              >
                {showAdminSecret ? (
                  <EyeOffIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
          <div className="!my-4 border-t" />

          <div className="grid grid-cols-2 gap-2 px-4 lg:grid-cols-3">
            <p>NHOST_WEBHOOK_SECRET</p>

            <div className="grid grid-flow-col items-center justify-start gap-2 lg:col-span-2">
              <p className="truncate">
                {showWebhookSecret ? (
                  <InlineCode className="!text-sm font-medium">
                    {webhookSecret}
                  </InlineCode>
                ) : (
                  '●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●'
                )}
              </p>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={
                  showWebhookSecret
                    ? 'Hide Webhook Secret'
                    : 'Show Webhook Secret'
                }
                onClick={() => setShowWebhookSecret((show) => !show)}
              >
                {showWebhookSecret ? (
                  <EyeOffIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
          <div className="!my-4 border-t" />

          {systemEnvironmentVariables.map((environmentVariable, index) => (
            <Fragment key={environmentVariable.key}>
              <div className="grid grid-cols-2 gap-2 px-4 lg:grid-cols-3">
                <p>{environmentVariable.key}</p>

                <p className="truncate lg:col-span-2">
                  {environmentVariable.value}
                </p>
              </div>

              {index !== systemEnvironmentVariables.length - 1 && (
                <div className="!my-4 border-t" />
              )}
            </Fragment>
          ))}
          <div className="!mb-2.5 !mt-4 border-t" />

          <div className="grid grid-cols-2 justify-start px-4 lg:grid-cols-3">
            <p>NHOST_JWT_SECRET</p>

            <div className="grid grid-flow-row items-center justify-center gap-1.5 text-center md:grid-flow-col lg:col-span-2 lg:justify-start lg:text-left">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary-main hover:bg-primary-highlight hover:text-primary-main"
                onClick={showViewJwtSecretModal}
              >
                Show JWT Secret
              </Button>
            </div>
          </div>
        </div>
      </SettingsCardContent>

      <SettingsCardFooter>
        <SettingsDocsLink
          href="https://docs.nhost.io/platform/cloud/environment-variables#system-environment-variables"
          title="System Environment Variables"
        />
      </SettingsCardFooter>
    </SettingsCard>
  );
}
