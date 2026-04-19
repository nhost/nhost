import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetAuthenticationSettingsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';

const validationSchema = Yup.object({
  disabled: Yup.boolean(),
});

export type DisableAutoSignupFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function DisableAutoSignupSettings() {
  const { project } = useProject();
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const form = useForm<DisableAutoSignupFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      disabled: !!data?.config?.auth?.signUp?.disableAutoSignup,
    },
  });

  useEffect(() => {
    if (!loading) {
      form.reset({
        disabled: !!data?.config?.auth?.signUp?.disableAutoSignup,
      });
    }
  }, [loading, data, form]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading disable auto signup settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState } = form;

  const handleDisableAutoSignupChange = async (
    values: DisableAutoSignupFormValues,
  ) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project!.id,
        config: {
          auth: {
            signUp: {
              disableAutoSignup: values.disabled,
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
        loadingMessage: 'Updating auto signup setting...',
        successMessage: 'Auto signup setting has been updated successfully.',
        errorMessage:
          'An error occurred while trying to update the auto signup setting.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleDisableAutoSignupChange}>
        <SettingsContainer
          title="Disable Auto Sign Up"
          description="If set, signing in with a method that doesn't have an existing user will not automatically create a new account. Users must explicitly register through the corresponding sign-up endpoint."
          docsLink="https://docs.nhost.io/products/auth/controlling-user-creation"
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
