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
} from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { FormField } from '@/components/ui/v3/form';
import { Switch } from '@/components/ui/v3/switch';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetSignInMethodsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';

const validationSchema = Yup.object({
  enabled: Yup.boolean(),
});

export type OTPEmailSettingsFormValues = Yup.InferType<typeof validationSchema>;

export default function OTPEmailSettings() {
  const { project } = useProject();
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetSignInMethodsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const enabled = !!data?.config?.auth?.method?.otp?.email?.enabled;

  const form = useForm<OTPEmailSettingsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled,
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading) {
      form.reset({ enabled });
    }
  }, [loading, enabled, form]);

  if (error) {
    throw error;
  }

  const handleOTPEmailSettingsChange = async (
    values: OTPEmailSettingsFormValues,
  ) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          auth: {
            method: {
              otp: {
                email: {
                  enabled: values.enabled,
                },
              },
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
        loadingMessage:
          'One-time passwords over email settings are being updated...',
        successMessage:
          'One-time passwords over email settings have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update one-time passwords over email settings.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleOTPEmailSettingsChange}>
        <SettingsCard>
          <SettingsCardHeader
            title="One-Time Passwords over email"
            description="Allow users to sign in with a one-time password sent to their email address."
            control={
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Toggle One-Time Passwords over email"
                  />
                )}
              />
            }
          />

          <SettingsCardFooter>
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
