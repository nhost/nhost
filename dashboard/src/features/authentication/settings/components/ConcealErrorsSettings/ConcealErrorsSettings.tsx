import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import {
  GetAuthenticationSettingsDocument,
  useGetAuthenticationSettingsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  enabled: Yup.boolean(),
});

export type ToggleConcealErrorsFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function ConcealErrorsSettings() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetAuthenticationSettingsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: currentProject?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const form = useForm<ToggleConcealErrorsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled: data?.config?.auth?.misc?.concealErrors,
    },
  });

  useEffect(() => {
    if (!loading) {
      form.reset({
        enabled: data?.config?.auth?.misc?.concealErrors,
      });
    }
  }, [loading, data, form]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading conceal error settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState } = form;

  const handleToggleConcealErrors = async (
    values: ToggleConcealErrorsFormValues,
  ) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
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
        <SettingsContainer
          title="Conceal errors"
          description="If set, conceals sensitive error messages to prevent leaking information about user accounts."
          switchId="enabled"
          showSwitch
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          className="hidden"
        />
      </Form>
    </FormProvider>
  );
}
