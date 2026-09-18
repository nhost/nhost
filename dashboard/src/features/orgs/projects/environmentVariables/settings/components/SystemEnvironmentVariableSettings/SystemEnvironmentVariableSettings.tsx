import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useState } from 'react';
import { AppDialog } from '@/components/layout/AppDialog';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardHeader,
  SettingsDocsLink,
  SettingsTable,
  SettingsTableBody,
  SettingsTableHeader,
  SettingsTableRow,
} from '@/components/layout/SettingsCard';
import { Button } from '@/components/ui/v3/button';
import { IconButton } from '@/components/ui/v3/icon-button';
import { InlineCode } from '@/components/ui/v3/inline-code';
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
  const localMimirClient = useLocalMimirClient();
  const [showAdminSecret, setShowAdminSecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [jwtSecretDialogOpen, setJwtSecretDialogOpen] = useState(false);

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
    setJwtSecretDialogOpen(true);
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
        title={
          <span className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">
              System Environment Variables
            </h3>
            <SettingsDocsLink
              href="https://docs.nhost.io/platform/cloud/environment-variables#system-environment-variables"
              title="System Environment Variables"
            />
          </span>
        }
        description="System environment variables are automatically generated from the configuration file and your project's subdomain and region."
      />

      <SettingsCardContent className="mt-6 mb-2.5 px-0">
        <SettingsTable>
          <SettingsTableHeader className="grid grid-cols-3 gap-2">
            <p className="font-bold">Variable Name</p>
            <p className="font-bold lg:col-span-2">Value</p>
          </SettingsTableHeader>

          <SettingsTableBody>
            <SettingsTableRow className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              <p>NHOST_ADMIN_SECRET</p>

              <div className="flex items-center gap-2 lg:col-span-2">
                <p className="min-w-0 break-words">
                  {showAdminSecret ? (
                    <InlineCode className="!text-sm whitespace-normal font-medium">
                      {adminSecret}
                    </InlineCode>
                  ) : (
                    '●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●'
                  )}
                </p>

                <IconButton
                  icon={showAdminSecret ? EyeOffIcon : EyeIcon}
                  aria-label={
                    showAdminSecret ? 'Hide Admin Secret' : 'Show Admin Secret'
                  }
                  onClick={() => setShowAdminSecret((show) => !show)}
                />
              </div>
            </SettingsTableRow>

            <SettingsTableRow className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              <p>NHOST_WEBHOOK_SECRET</p>

              <div className="flex items-center gap-2 lg:col-span-2">
                <p className="min-w-0 break-words">
                  {showWebhookSecret ? (
                    <InlineCode className="!text-sm whitespace-normal font-medium">
                      {webhookSecret}
                    </InlineCode>
                  ) : (
                    '●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●'
                  )}
                </p>

                <IconButton
                  icon={showWebhookSecret ? EyeOffIcon : EyeIcon}
                  aria-label={
                    showWebhookSecret
                      ? 'Hide Webhook Secret'
                      : 'Show Webhook Secret'
                  }
                  onClick={() => setShowWebhookSecret((show) => !show)}
                />
              </div>
            </SettingsTableRow>

            {systemEnvironmentVariables.map((environmentVariable) => (
              <SettingsTableRow
                key={environmentVariable.key}
                className="grid grid-cols-2 gap-2 lg:grid-cols-3"
              >
                <p>{environmentVariable.key}</p>

                <p className="truncate lg:col-span-2">
                  {environmentVariable.value}
                </p>
              </SettingsTableRow>
            ))}

            <SettingsTableRow className="grid grid-cols-2 justify-start lg:grid-cols-3">
              <p>NHOST_JWT_SECRET</p>

              <div className="grid grid-flow-row items-center justify-center gap-1.5 text-center md:grid-flow-col lg:col-span-2 lg:justify-start lg:text-left">
                <Button
                  type="button"
                  variant="outline-emboss"
                  size="sm"
                  onClick={showViewJwtSecretModal}
                >
                  Show JWT Secret
                </Button>
              </div>
            </SettingsTableRow>
          </SettingsTableBody>
        </SettingsTable>
      </SettingsCardContent>

      <AppDialog
        type="form"
        open={jwtSecretDialogOpen}
        onOpenChange={setJwtSecretDialogOpen}
        title="Auth JWT Secret"
        description="This is the key used for generating JWTs. It's the same as configured in Hasura."
      >
        <EditJwtSecretForm
          disabled
          jwtSecret={stringifiedJwtSecrets}
          onCancel={() => setJwtSecretDialogOpen(false)}
        />
      </AppDialog>
    </SettingsCard>
  );
}
