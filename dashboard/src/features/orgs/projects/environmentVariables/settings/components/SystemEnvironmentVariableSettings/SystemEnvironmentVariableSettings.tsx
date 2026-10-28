import { useDialog } from '@/components/common/DialogProvider';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';
import { Button } from '@/components/ui/v3/button';
import { TableCell, TableRow } from '@/components/ui/v3/table';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import {
  defaultRemoteBackendSlugs,
  generateAppServiceUrl,
} from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { EditJwtSecretForm } from '@/features/orgs/projects/environmentVariables/settings/components/EditJwtSecretForm';
import { MaskedValue } from '@/features/orgs/projects/environmentVariables/settings/components/MaskedValue';
import { VariableGroup } from '@/features/orgs/projects/environmentVariables/settings/components/VariableGroup';
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
          <span>Auth JWT secret</span>

          <span className="text-muted-foreground text-sm">
            This is the key used for generating JWTs. It&apos;s the same as
            configured in Hasura.
          </span>
        </span>
      ),
      component: (
        <EditJwtSecretForm disabled jwtSecret={stringifiedJwtSecrets} />
      ),
    });
  }

  const projectVariables = [
    { key: 'NHOST_SUBDOMAIN', value: project!.subdomain },
    { key: 'NHOST_REGION', value: project!.region.name },
  ];

  const serviceUrlVariables = [
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
    <SettingsCard>
      <SettingsCardHeader
        title="System environment variables"
        description="Set automatically from your configuration file and your project's subdomain and region."
        docsLink={{
          href: 'https://docs.nhost.io/platform/cloud/environment-variables#system-environment-variables',
          topic: 'System Environment Variables',
        }}
      />

      {/* The system variables are a fixed list, so their groups are set
          here, not guessed from the names. Each group is its own box. */}
      <SettingsCardContent className="mt-2 gap-6">
        <VariableGroup label="Project">
          {projectVariables.map((variable) => (
            <ValueRow
              key={variable.key}
              name={variable.key}
              value={variable.value}
            />
          ))}
        </VariableGroup>

        <VariableGroup label="Service URLs">
          {serviceUrlVariables.map((variable) => (
            <ValueRow
              key={variable.key}
              name={variable.key}
              value={variable.value}
            />
          ))}
        </VariableGroup>

        <VariableGroup label="Secrets">
          <TableRow className="group">
            <TableCell className="font-mono">NHOST_ADMIN_SECRET</TableCell>
            <TableCell>
              <MaskedValue name="NHOST_ADMIN_SECRET" value={adminSecret} />
            </TableCell>
          </TableRow>
          <TableRow className="group">
            <TableCell className="font-mono">NHOST_WEBHOOK_SECRET</TableCell>
            <TableCell>
              <MaskedValue name="NHOST_WEBHOOK_SECRET" value={webhookSecret} />
            </TableCell>
          </TableRow>
          <TableRow className="group">
            <TableCell className="font-mono">NHOST_JWT_SECRET</TableCell>
            <TableCell>
              <Button
                type="button"
                variant="outline"
                onClick={showViewJwtSecretModal}
              >
                Show JWT secret
              </Button>
            </TableCell>
          </TableRow>
        </VariableGroup>
      </SettingsCardContent>
    </SettingsCard>
  );
}

// A variable with a plain value, copied from the icon that shows on row hover.
function ValueRow({ name, value }: { name: string; value: string }) {
  return (
    <TableRow className="group">
      <TableCell className="font-mono">{name}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="min-w-0 break-all text-muted-foreground">
            {value}
          </span>
          <CopyToClipboardButton
            className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
            textToCopy={value}
            title={name}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}
