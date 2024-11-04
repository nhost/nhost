import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { ControlledCheckbox } from '@/components/form/ControlledCheckbox';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import {
  useGetSignInMethodsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

const validationSchema = Yup.object({
  emailVerificationRequired: Yup.boolean(),
  hibpEnabled: Yup.boolean(),
  passwordMinLength: Yup.number()
    .label('Minimum password length')
    .min(3)
    .typeError('Minimum password length must be a number')
    .required(),
});

export type EmailAndPasswordFormValues = Yup.InferType<typeof validationSchema>;

export default function EmailAndPasswordSettings() {
  const { project } = useProject();
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, error, loading } = useGetSignInMethodsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { hibpEnabled, emailVerificationRequired, passwordMinLength } =
    data?.config?.auth?.method?.emailPassword || {};

  const form = useForm<EmailAndPasswordFormValues>({
    reValidateMode: 'onChange',
    defaultValues: {
      hibpEnabled: hibpEnabled || false,
      emailVerificationRequired: emailVerificationRequired || false,
      passwordMinLength: passwordMinLength || 9,
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading) {
      form.reset({
        hibpEnabled,
        emailVerificationRequired,
        passwordMinLength,
      });
    }
  }, [
    loading,
    hibpEnabled,
    emailVerificationRequired,
    passwordMinLength,
    form,
  ]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading email and password sign-in settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState, register } = form;

  async function handleSubmit(formValues: EmailAndPasswordFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project.id,
        config: {
          auth: {
            method: {
              emailPassword: formValues,
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
        loadingMessage: `Email and password sign-in settings are being updated...`,
        successMessage:
          'Email and password sign-in settings have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update email sign-in settings.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Email and Password"
          description="Allow users to sign in with email and password."
          docsLink="https://docs.nhost.io/guides/auth/sign-in-email-password"
          docsTitle="how to sign in users with email and password"
          className="grid grid-flow-row"
          showSwitch
          enabled
          slotProps={{
            switch: { disabled: true },
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
        >
          <Input
            {...register('passwordMinLength')}
            id="passwordMinLength"
            name="passwordMinLength"
            type="number"
            label="Minimum required password length"
            fullWidth
            className="lg:max-w-[50%]"
            error={Boolean(formState.errors.passwordMinLength?.message)}
            helperText={formState.errors.passwordMinLength?.message}
            slotProps={{ inputRoot: { min: 3 } }}
          />

          <ControlledCheckbox
            name="emailVerificationRequired"
            id="emailVerificationRequired"
            label={
              <span className="inline-grid grid-flow-row gap-y-0.5 text-sm+">
                <Text component="span">Require Verified Emails</Text>
                <Text component="span" color="secondary">
                  Users must verify their email to be able to sign in.
                </Text>
              </span>
            }
          />

          <ControlledCheckbox
            name="hibpEnabled"
            id="hibpEnabled"
            label={
              <span className="inline-grid grid-flow-row gap-y-0.5 text-sm+">
                <Text component="span">Password Protection</Text>
                <Text component="span" color="secondary">
                  Passwords must pass haveibeenpwned.com during sign-up.
                </Text>
              </span>
            }
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
