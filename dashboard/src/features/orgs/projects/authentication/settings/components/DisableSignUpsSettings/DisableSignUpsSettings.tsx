import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import {
  useGetAuthenticationSettingsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

const validationSchema = Yup.object({
  disabled: Yup.boolean(),
});

export type DisableSignUpsFormValues = Yup.InferType<typeof validationSchema>;

export default function DisableSignUpsSettings() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();
  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const form = useForm<DisableSignUpsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      disabled: !data?.config?.auth?.signUp?.enabled,
    },
  });

  useEffect(() => {
    if (!loading) {
      form.reset({
        disabled: !data?.config?.auth?.signUp?.enabled,
      });
    }
  }, [loading, data, form]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading disabled sign up settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState } = form;

  const handleDisableSignUpsChange = async (
    values: DisableSignUpsFormValues,
  ) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project.id,
        config: {
          auth: {
            signUp: {
              enabled: !values.disabled,
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
        loadingMessage: 'Disabling new users sign ups...',
        successMessage: 'New users sign ups have been disabled successfully.',
        errorMessage:
          'An error occurred while trying to disable new users sign ups.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleDisableSignUpsChange}>
        <SettingsContainer
          title="Disable Sign Ups"
          description="If set, new users won't be able to sign up."
          docsLink="https://docs.nhost.io/guides/auth/overview#disable-sign-ups"
          switchId="disabled"
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
