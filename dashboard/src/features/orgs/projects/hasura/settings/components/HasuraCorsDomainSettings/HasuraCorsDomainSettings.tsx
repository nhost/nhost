import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { FormField } from '@/components/ui/v3/form';
import { Switch } from '@/components/ui/v3/switch';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetHasuraSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { isNotEmptyValue } from '@/lib/utils';

const validationSchema = Yup.object({
  enabled: Yup.boolean().label('Enabled'),
  corsDomain: Yup.string()
    .label('Allowed CORS domains')
    .when('enabled', {
      is: true,
      // biome-ignore lint/suspicious/noThenProperty: yup
      then: (schema) => schema.required(),
    }),
});

export type HasuraCorsDomainFormValues = Yup.InferType<typeof validationSchema>;

export default function HasuraCorsDomainSettings() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project, refetch: refetchProject } = useProject();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, error } = useGetHasuraSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { corsDomain } = data?.config?.hasura.settings || {};

  const form = useForm<HasuraCorsDomainFormValues>({
    reValidateMode: 'onSubmit',
    values: {
      enabled:
        corsDomain && corsDomain.length === 1
          ? corsDomain[0] !== '*'
          : !!corsDomain?.length,
      corsDomain:
        corsDomain && corsDomain.length === 1 && corsDomain[0] !== '*'
          ? corsDomain[0]
          : corsDomain?.join(', ') || '',
    },
    resolver: yupResolver(validationSchema),
  });

  const { formState, watch } = form;
  const enabled = watch('enabled');
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  if (error) {
    throw error;
  }

  async function handleSubmit(formValues: HasuraCorsDomainFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          hasura: {
            settings: {
              corsDomain:
                formValues.enabled && isNotEmptyValue(formValues?.corsDomain)
                  ? formValues.corsDomain
                      .split(',')
                      .map((domain) => domain.trim())
                  : ['*'],
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(formValues);
        await refetchProject();

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
        loadingMessage: 'CORS domain settings are being updated...',
        successMessage: 'CORS domain settings have been updated successfully.',
        errorMessage: `An error occurred while trying to update the project's CORS domain settings.`,
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsCard>
          <SettingsCardHeader
            title="Configure CORS"
            description="Allow requests from specific domains to access your GraphQL API. Disable this setting to allow requests from all domains."
            control={
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Toggle CORS configuration"
                  />
                )}
              />
            }
          />

          {enabled && (
            <SettingsCardContent className="grid-cols-5 gap-x-4 gap-y-2">
              <FormInput
                control={form.control}
                name="corsDomain"
                label="Allowed CORS domains"
                placeholder="https://example.com, https://*.example.com"
                containerClassName="col-span-5 lg:col-span-2"
              />
            </SettingsCardContent>
          )}

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://hasura.io/docs/latest/deployment/graphql-engine-flags/config-examples/#configure-cors"
              title="CORS configuration"
            />

            <ButtonWithLoading
              type="submit"
              disabled={!isDirty}
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
