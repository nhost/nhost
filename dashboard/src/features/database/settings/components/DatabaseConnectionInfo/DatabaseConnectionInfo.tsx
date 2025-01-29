import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Button } from '@/components/ui/v2/Button';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import type { InputProps } from '@/components/ui/v2/Input';
import { Input } from '@/components/ui/v2/Input';
import { InputAdornment } from '@/components/ui/v2/InputAdornment';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import {
  useGetPostgresSettingsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { copy } from '@/utils/copy';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const databasePublicAccessValidationSchema = Yup.object({
  enablePublicAccess: Yup.bool(),
});

type DatabasePublicAccessFormValues = Yup.InferType<
  typeof databasePublicAccessValidationSchema
>;

export default function DatabaseConnectionInfo() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { data, loading, error } = useGetPostgresSettingsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-only',
  });

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const enablePublicAccess =
    !!data?.config?.postgres?.resources?.enablePublicAccess;

  const form = useForm<DatabasePublicAccessFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enablePublicAccess,
    },
    resolver: yupResolver(databasePublicAccessValidationSchema),
  });

  async function handleSubmit(formValues: DatabasePublicAccessFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          postgres: {
            resources: {
              enablePublicAccess: formValues.enablePublicAccess,
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(formValues);

        if (!isPlatform) {
          openDialog({
            title: 'Apply your changes',
            component: <ApplyLocalSettingsDialog />,
            props: {
              PaperProps: {
                className: 'max-w-2xl',
              },
            },
          });
        }
      },
      {
        loadingMessage: 'Database settings are being updated...',
        successMessage: 'Database settings have been updated successfully.',
        errorMessage:
          "An error occurred while trying to update the project's database settings.",
      },
    );
  }

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

  const { formState } = form;

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Public access"
          description={
            enablePublicAccess
              ? 'Connect directly to the Postgres database with this information.'
              : 'Enable public access to your Postgres database.'
          }
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          className="grid grid-cols-6 gap-4 pb-2"
          switchId="enablePublicAccess"
          showSwitch
        >
          {enablePublicAccess && (
            <>
              {settingsDatabaseCustomInputs.map(
                ({ name, label, className, value: inputValue }) => (
                  <Input
                    key={name}
                    label={label}
                    required
                    disabled
                    value={inputValue}
                    className={className}
                    slotProps={{ inputRoot: { className: '!pr-8 truncate' } }}
                    fullWidth
                    hideEmptyHelperText
                    endAdornment={
                      <InputAdornment
                        position="end"
                        className="absolute right-2"
                      >
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
                    }
                  />
                ),
              )}
              <Alert severity="info" className="col-span-6 text-left">
                To connect to the Postgres database directly, generate a new
                password, securely save it, and then modify your connection
                string with the newly created password.
              </Alert>
            </>
          )}
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
