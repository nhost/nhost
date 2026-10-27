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

export type HasuraInferFunctionPermissionsFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function HasuraInferFunctionPermissionsSettings() {
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

  const { inferFunctionPermissions } = data?.config?.hasura.settings || {};

  const form = useForm<HasuraInferFunctionPermissionsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled: !!inferFunctionPermissions,
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading) {
      form.reset({
        enabled: !!inferFunctionPermissions,
      });
    }
  }, [loading, inferFunctionPermissions, form]);

  if (error) {
    throw error;
  }

  async function handleSubmit(
    formValues: HasuraInferFunctionPermissionsFormValues,
  ) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          hasura: {
            settings: {
              inferFunctionPermissions: formValues.enabled,
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
        loadingMessage:
          'Infer function permission settings are being updated...',
        successMessage:
          'Infer function permission settings have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update infer function permission settings.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsCard>
          <SettingsCardHeader
            title="Infer Function Permissions"
            description="Enable or disable infer function permissions."
            control={
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Toggle Infer Function Permissions"
                  />
                )}
              />
            }
          />

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://hasura.io/docs/2.0/deployment/graphql-engine-flags/reference/#infer-function-permissions"
              title="enabling or disabling Infer Function Permissions"
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
