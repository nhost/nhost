import Container from '@/components/layout/Container';
import SettingsLayout from '@/components/settings/SettingsLayout';

import { useGetDatabaseConnectionInfoQuery } from '@/generated/graphql';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import { isDevOrStaging } from '@/utils/helpers';
import type { ReactElement } from 'react';

import SettingsContainer from '@/components/settings/SettingsContainer';

import ResetDatabasePasswordSettings from '@/components/settings/ResetDatabasePasswordSettings';
import { useCurrentWorkspaceAndProject } from '@/hooks/v2/useCurrentWorkspaceAndProject';
import Button from '@/ui/v2/Button';
import type { InputProps } from '@/ui/v2/Input';
import Input from '@/ui/v2/Input';
import InputAdornment from '@/ui/v2/InputAdornment';
import CopyIcon from '@/ui/v2/icons/CopyIcon';
import { copy } from '@/utils/copy';

export default function DatabaseSettingsPage() {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const postgresHost = `${currentProject.subdomain}.db.${
    currentProject.region.awsName
  }.${isDevOrStaging() ? 'staging.nhost' : 'nhost'}.run`;

  const { data, loading, error } = useGetDatabaseConnectionInfoQuery({
    variables: {
      appId: currentProject?.id,
    },
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading database connection info..."
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
    <Container
      className="grid max-w-5xl grid-flow-row gap-y-6 bg-transparent"
      rootClassName="bg-transparent"
    >
      <SettingsContainer
        title="Connection Info"
        description="Connect directly to the Postgres database with this information."
        slotProps={{ submitButton: { disabled: true, className: 'invisible' } }}
        className="grid grid-cols-6 gap-4"
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
      <ResetDatabasePasswordSettings />
    </Container>
  );
}

DatabaseSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
