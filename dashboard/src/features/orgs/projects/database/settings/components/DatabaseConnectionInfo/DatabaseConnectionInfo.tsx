import { yupResolver } from '@hookform/resolvers/yup';
import { CopyIcon } from 'lucide-react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { Alert } from '@/components/ui/v3/alert';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { FormField } from '@/components/ui/v3/form';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/v3/input-group';
import { Label } from '@/components/ui/v3/label';
import { Switch } from '@/components/ui/v3/switch';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetPostgresSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { copy } from '@/utils/copy';

const databasePublicAccessValidationSchema = Yup.object({
  enablePublicAccess: Yup.bool(),
});

type DatabasePublicAccessFormValues = Yup.InferType<
  typeof databasePublicAccessValidationSchema
>;

export default function DatabaseConnectionInfo() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();

  const { data, error } = useGetPostgresSettingsQuery({
    variables: { appId: project?.id },
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
        appId: project?.id,
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

  if (error) {
    throw new Error(
      `Error: ${
        error.message || 'An unknown error occurred. Please try again.'
      }`,
    );
  }

  const postgresHost = generateAppServiceUrl(
    project!.subdomain,
    project!.region,
    'db',
  ).replace('https://', '');

  const settingsDatabaseCustomInputs: Array<{
    name: string;
    label: string;
    value: string | number | undefined;
    className: string;
  }> = [
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
        <SettingsCard>
          <SettingsCardHeader
            title="Public access"
            description={
              enablePublicAccess
                ? 'Connect directly to the Postgres database with this information.'
                : 'Enable public access to your Postgres database.'
            }
            control={
              <FormField
                control={form.control}
                name="enablePublicAccess"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Toggle Public access"
                  />
                )}
              />
            }
          />

          <SettingsCardContent className="grid-cols-6 pb-2">
            {enablePublicAccess && (
              <>
                {settingsDatabaseCustomInputs.map(
                  ({ name, label, className, value: inputValue }) => (
                    <div key={name} className={className}>
                      <Label htmlFor={name}>{label}</Label>
                      <InputGroup className="mt-2 bg-transparent dark:bg-transparent">
                        <InputGroupInput
                          id={name}
                          required
                          disabled
                          readOnly
                          value={inputValue}
                          className="truncate"
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton
                            aria-label={`Copy ${label}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              copy(inputValue as string, `${label}`);
                            }}
                          >
                            <CopyIcon className="h-4 w-4" />
                          </InputGroupButton>
                        </InputGroupAddon>
                      </InputGroup>
                    </div>
                  ),
                )}
                <Alert className="col-span-6 text-left">
                  To connect to the Postgres database directly, generate a new
                  password, securely save it, and then modify your connection
                  string with the newly created password.
                </Alert>
              </>
            )}
          </SettingsCardContent>

          <SettingsCardFooter>
            <ButtonWithLoading
              type="submit"
              disabled={!formState.isDirty}
              loading={formState.isSubmitting}
              className="w-full sm:w-auto"
            >
              Save
            </ButtonWithLoading>
          </SettingsCardFooter>
        </SettingsCard>
      </Form>
    </FormProvider>
  );
}
