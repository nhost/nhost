import Container from '@/components/layout/Container';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Button from '@/ui/v2/Button';
import CopyIcon from '@/ui/v2/icons/CopyIcon';
import type { InputProps } from '@/ui/v2/Input';
import Input from '@/ui/v2/Input';
import InputAdornment from '@/ui/v2/InputAdornment';
import Text from '@/ui/v2/Text';
import { copy } from '@/utils/copy';
import { isDevOrStaging } from '@/utils/helpers';
import { useGetDatabaseConnectionInfoQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import type { Optional } from 'utility-types';

export interface CustomDatabaseInputProps
  extends Optional<Pick<InputProps, 'value' | 'className'>, 'className'> {
  /**
   * Label for the input field.
   */
  label: string;
  /**
   * Disable end adornment for this custom input.
   */
  disabledEndAdornment?: boolean;
}

export default function DatabaseSettingsPage() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const postgresHost = `${currentApplication.subdomain}.db.${
    currentApplication.region.awsName
  }.${isDevOrStaging() ? 'staging.nhost' : 'nhost'}.run`;

  const { data, loading, error } = useGetDatabaseConnectionInfoQuery({
    variables: {
      id: currentApplication.id,
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
    throw error || new Error('Unknown error occurred. Please try again later.');
  }

  const settingsDatabaseCustomInputs: CustomDatabaseInputProps[] = [
    {
      label: 'Postgres Host',
      value: postgresHost,
    },
    {
      label: 'Port',
      value: 5432,
      className: 'lg:col-span-1',
    },
    {
      label: 'Database Name',
      value: data.app.postgresDatabase,
      className: 'lg:col-span-2',
    },
    {
      label: 'Username',
      value: 'postgres',
    },
    {
      label: 'Password',
      value: 'The one you used when you created the project.',
      disabledEndAdornment: true,
    },
    {
      label: 'Connection String',
      value: `postgres://postgres:[YOUR-PASSWORD]@${postgresHost}:5432/${data.app.postgresDatabase}`,
      className: 'lg:col-span-6',
    },
  ];

  return (
    <Container className="bg-fafafa" wrapperClassName="bg-fafafa">
      <div className="flex flex-col gap-4 rounded-xl border-1 border-[#E5E7EB] bg-white">
        <div className="flex flex-col gap-1 px-6 py-4">
          <Text variant="h3" className="text-greyscaleDark">
            Connection Info
          </Text>

          <Text variant="body1">
            Connect directly to the Postgres database with this information.
          </Text>
        </div>
        <div className="grid grid-flow-row grid-rows-3 gap-4 px-6 lg:grid-cols-6">
          {settingsDatabaseCustomInputs.map(
            ({ label, value, className, disabledEndAdornment }) => (
              <Input
                disabled
                key={label}
                label={label}
                componentsProps={{
                  label: {
                    className: 'text-sm+ font-medium text-greyscaleDark pb-2',
                  },
                }}
                placeholder={label}
                value={value}
                className={twMerge('lg:col-span-3', className)}
                fullWidth
                endAdornment={
                  !disabledEndAdornment && (
                    <InputAdornment position="end" className="absolute right-2">
                      <Button
                        sx={{ minWidth: 0, padding: 0 }}
                        color="secondary"
                        onClick={() => {
                          copy(value.toString(), label);
                        }}
                        variant="borderless"
                      >
                        <CopyIcon className="h-4 w-4" />
                      </Button>
                    </InputAdornment>
                  )
                }
              />
            ),
          )}
        </div>
        <div className="flex flex-col place-items-end border-t py-3.5 px-6">
          <Button className="" disabled variant="outlined" color="secondary">
            Save
          </Button>
        </div>
      </div>
    </Container>
  );
}

DatabaseSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <SettingsLayout
      mainContainerProps={{
        className: 'bg-fafafa',
      }}
    >
      {page}
    </SettingsLayout>
  );
};
