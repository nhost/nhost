import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import {
  SettingsCard,
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

const validationSchema = Yup.object({
  enabled: Yup.boolean(),
});

export type HasuraDevModeFormValues = Yup.InferType<typeof validationSchema>;

export default function HasuraDevModeSettings() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project, refetch: refetchProject } = useProject();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { devMode } = data?.config?.hasura.settings || {};

  const form = useForm<HasuraDevModeFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled: !!devMode,
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading) {
      form.reset({
        enabled: !!devMode,
      });
    }
  }, [loading, devMode, form]);

  if (error) {
    throw error;
  }

  async function handleSubmit(formValues: HasuraDevModeFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          hasura: {
            settings: {
              devMode: formValues.enabled,
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
        loadingMessage: 'Dev Mode settings are being updated...',
        successMessage: 'Dev Mode settings have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update Dev Mode settings.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsCard>
          <SettingsCardHeader
            title="Dev Mode"
            description="Enable or disable Dev Mode."
            control={
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Toggle Dev Mode"
                  />
                )}
              />
            }
          />

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://hasura.io/learn/graphql/hasura-advanced/debugging/1-dev-mode/"
              title="enabling or disabling Dev Mode"
            />

            <ButtonWithLoading
              type="submit"
              disabled={!form.formState.isDirty}
              loading={form.formState.isSubmitting}
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
