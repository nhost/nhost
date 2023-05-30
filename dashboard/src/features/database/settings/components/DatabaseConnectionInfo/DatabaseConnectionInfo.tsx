import { SettingsContainer } from '@/components/settings/SettingsContainer';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { ActivityIndicator } from '@/ui/v2/ActivityIndicator';
import { Button } from '@/ui/v2/Button';
import { CopyIcon } from '@/ui/v2/icons/CopyIcon';
import type { InputProps } from '@/ui/v2/Input';
import { Input } from '@/ui/v2/Input';
import { InputAdornment } from '@/ui/v2/InputAdornment';
import copy from '@/utils/common/copy';
import { generateAppServiceUrl } from '@/utils/common/generateAppServiceUrl';
import { useGetPostgresSettingsQuery } from '@/utils/__generated__/graphql';

export default function DatabaseConnectionInfo() {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { data, loading, error } = useGetPostgresSettingsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-only',
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Postgres settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw new Error(
      `Error: ${
        error.message || 'An unknown error occurred. Please try again.'
      }`,
    );
  }

  const postgresHost = generateAppServiceUrl(
    currentProject.subdomain,
    currentProject.region,
    'db',
  ).replace('https://', '');

  const settingsDatabaseCustomInputs: InputProps[] = [
    {
      name: 'postgresHost',
      label: 'Postgres Host',
      value: postgresHost,
      className: 'col-span-6 lg:col-span-3',
    },
    {
      name: 'port',
      label: 'Port',
      value: 5432,
      className: 'col-span-6 lg:col-span-3',
    },
    {
      name: 'postgresDatabase',
      label: 'Database Name',
      value: data?.systemConfig?.postgres.database,
      className: 'col-span-6',
    },
    {
      name: 'postgresUser',
      label: 'Username',
      value: 'postgres',
      className: 'col-span-6',
    },
    {
      name: 'connectiongString',
      label: 'Connection String',
      value: `postgres://postgres:[YOUR-PASSWORD]@${postgresHost}:5432/${data?.systemConfig?.postgres.database}`,
      className: 'col-span-6',
    },
  ];

  return (
    <SettingsContainer
      title="Connection Info"
      description="Connect directly to the Postgres database with this information."
      slotProps={{ footer: { className: 'hidden' } }}
      className="grid grid-cols-6 gap-4 pb-2"
    >
      {settingsDatabaseCustomInputs.map(
        ({ name, label, className, value: inputValue }) => (
          <Input
            key={name}
            label={label}
            required
            disabled
            value={inputValue}
            className={className}
            fullWidth
            hideEmptyHelperText
            endAdornment={
              name !== 'postgresPassword' && (
                <InputAdornment position="end" className="absolute right-2">
                  <Button
                    sx={{ minWidth: 0, padding: 0 }}
                    color="secondary"
                    variant="borderless"
                    onClick={(e) => {
                      e.stopPropagation();
                      copy(inputValue as string, `${label}`);
                    }}
                  >
                    <CopyIcon className="h-4 w-4" />
                  </Button>
                </InputAdornment>
              )
            }
          />
        ),
      )}
    </SettingsContainer>
  );
}
