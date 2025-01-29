import { useDialog } from '@/components/common/DialogProvider';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { InlineCode } from '@/components/presentational/InlineCode';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { IconButton } from '@/components/ui/v2/IconButton';
import { EyeIcon } from '@/components/ui/v2/icons/EyeIcon';
import { EyeOffIcon } from '@/components/ui/v2/icons/EyeOffIcon';
import { List } from '@/components/ui/v2/List';
import { ListItem } from '@/components/ui/v2/ListItem';
import { Text } from '@/components/ui/v2/Text';

import { EditJwtSecretForm } from '@/features/orgs/projects/environmentVariables/settings/components/EditJwtSecretForm';
import { getJwtSecretsWithoutFalsyValues } from '@/features/orgs/projects/environmentVariables/settings/utils/getJwtSecretsWithoutFalsyValues';

import { useGetEnvironmentVariablesQuery } from '@/utils/__generated__/graphql';
import { getHasuraConsoleServiceUrl } from '@/utils/env';
import { Fragment, useState } from 'react';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import {
  defaultRemoteBackendSlugs,
  generateAppServiceUrl,
} from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useAppClient } from '@/features/orgs/projects/hooks/useAppClient';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function SystemEnvironmentVariableSettings() {
  const appClient = useAppClient();
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { openDialog } = useDialog();
  const localMimirClient = useLocalMimirClient();
  const [showAdminSecret, setShowAdminSecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const { data, loading, error } = useGetEnvironmentVariablesQuery({
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

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading system environment variables..."
      />
    );
  }

  if (error) {
    throw error;
  }

  function showViewJwtSecretModal() {
    openDialog({
      title: (
        <span className="grid grid-flow-row">
          <span>Auth JWT Secret</span>

          <Text variant="subtitle1" component="span">
            This is the key used for generating JWTs. It&apos;s the same as
            configured in Hasura.
          </Text>
        </span>
      ),
      component: (
        <EditJwtSecretForm disabled jwtSecret={stringifiedJwtSecrets} />
      ),
    });
  }

  const systemEnvironmentVariables = [
    { key: 'NHOST_SUBDOMAIN', value: project.subdomain },
    { key: 'NHOST_REGION', value: project.region.name },
    {
      key: 'NHOST_HASURA_URL',
      value:
        process.env.NEXT_PUBLIC_ENV === 'dev' || !isPlatform
          ? `${getHasuraConsoleServiceUrl()}/console`
          : generateAppServiceUrl(
              project?.subdomain,
              project?.region,
              'hasura',
              { ...defaultRemoteBackendSlugs, hasura: '/console' },
            ),
    },
    { key: 'NHOST_AUTH_URL', value: appClient.auth.url },
    { key: 'NHOST_GRAPHQL_URL', value: appClient.graphql.httpUrl },
    { key: 'NHOST_STORAGE_URL', value: appClient.storage.url },
    { key: 'NHOST_FUNCTIONS_URL', value: appClient.functions.url },
  ];

  return (
    <SettingsContainer
      title="System Environment Variables"
      description="System environment variables are automatically generated from the configuration file and your project's subdomain and region."
      docsLink="https://docs.nhost.io/platform/environment-variables#system-environment-variables"
      rootClassName="gap-0"
      className="mb-2.5 mt-2 px-0"
      slotProps={{ submitButton: { className: 'hidden' } }}
    >
      <Box className="grid grid-cols-3 gap-2 border-b-1 px-4 py-3">
        <Text className="font-medium">Variable Name</Text>
        <Text className="font-medium lg:col-span-2">Value</Text>
      </Box>

      <List>
        <ListItem.Root className="grid grid-cols-2 gap-2 px-4 lg:grid-cols-3">
          <ListItem.Text>NHOST_ADMIN_SECRET</ListItem.Text>

          <div className="grid grid-flow-col items-center justify-start gap-2 lg:col-span-2">
            <Text className="truncate" color="secondary">
              {showAdminSecret ? (
                <InlineCode className="!text-sm font-medium">
                  {adminSecret}
                </InlineCode>
              ) : (
                '●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●'
              )}
            </Text>

            <IconButton
              variant="borderless"
              color="secondary"
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
            </IconButton>
          </div>
        </ListItem.Root>

        <Divider component="li" className="!my-4" />

        <ListItem.Root className="grid grid-cols-2 gap-2 px-4 lg:grid-cols-3">
          <ListItem.Text>NHOST_WEBHOOK_SECRET</ListItem.Text>

          <div className="grid grid-flow-col items-center justify-start gap-2 lg:col-span-2">
            <Text className="truncate" color="secondary">
              {showWebhookSecret ? (
                <InlineCode className="!text-sm font-medium">
                  {webhookSecret}
                </InlineCode>
              ) : (
                '●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●'
              )}
            </Text>

            <IconButton
              variant="borderless"
              color="secondary"
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
            </IconButton>
          </div>
        </ListItem.Root>

        <Divider component="li" className="!my-4" />

        {systemEnvironmentVariables.map((environmentVariable, index) => (
          <Fragment key={environmentVariable.key}>
            <ListItem.Root className="grid grid-cols-2 gap-2 px-4 lg:grid-cols-3">
              <ListItem.Text>{environmentVariable.key}</ListItem.Text>

              <Text className="truncate lg:col-span-2">
                {environmentVariable.value}
              </Text>
            </ListItem.Root>

            {index !== systemEnvironmentVariables.length - 1 && (
              <Divider className="!my-4" />
            )}
          </Fragment>
        ))}

        <Divider component="li" className="!mb-2.5 !mt-4" />

        <ListItem.Root className="grid grid-cols-2 justify-start px-4 lg:grid-cols-3">
          <ListItem.Text>NHOST_JWT_SECRET</ListItem.Text>

          <div className="grid grid-flow-row items-center justify-center gap-1.5 text-center md:grid-flow-col lg:col-span-2 lg:justify-start lg:text-left">
            <Button
              variant="borderless"
              onClick={showViewJwtSecretModal}
              size="small"
            >
              Show JWT Secret
            </Button>
          </div>
        </ListItem.Root>
      </List>
    </SettingsContainer>
  );
}
