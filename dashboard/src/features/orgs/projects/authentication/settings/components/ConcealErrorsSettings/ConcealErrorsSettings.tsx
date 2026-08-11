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
} from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { FormField } from '@/components/ui/v3/form';
import { Switch } from '@/components/ui/v3/switch';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetAuthenticationSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';

const validationSchema = Yup.object({
  enabled: Yup.boolean(),
});

export type ToggleConcealErrorsFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function ConcealErrorsSettings() {
  const { project } = useProject();
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const form = useForm<ToggleConcealErrorsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled: !!data?.config?.auth?.misc?.concealErrors,
    },
  });

  useEffect(() => {
    if (!loading) {
      form.reset({
        enabled: !!data?.config?.auth?.misc?.concealErrors,
      });
    }
  }, [loading, data, form]);

  if (error) {
    throw error;
  }

  const { formState } = form;

  const handleToggleConcealErrors = async (
    values: ToggleConcealErrorsFormValues,
  ) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project!.id,
        config: {
          auth: {
            misc: {
              concealErrors: values.enabled,
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(values);

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
        loadingMessage: 'Updating conceal error settings...',
        successMessage: 'Conceal error settings updated successfully.',
        errorMessage:
          'Failed to update conceal error settings. Please try again.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleToggleConcealErrors}>
        <SettingsCard>
          <SettingsCardHeader
            title="Conceal errors"
            description="If set, conceals sensitive error messages to prevent leaking information about user accounts."
            control={
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Toggle Conceal errors"
                  />
                )}
              />
            }
          />

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
