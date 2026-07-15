import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormCheckbox } from '@/components/form/FormCheckbox';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Input } from '@/components/ui/v2/Input';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetSignInMethodsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';

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
        hibpEnabled: !!hibpEnabled,
        emailVerificationRequired: !!emailVerificationRequired,
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

  if (error) {
    throw error;
  }

  const { formState, register } = form;

  async function handleSubmit(formValues: EmailAndPasswordFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project!.id,
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
          docsLink="https://docs.nhost.io/products/auth/sign-in-email-password"
          docsTitle="how to sign in users with email and password"
          className="grid grid-flow-row"
          showSwitch
          enabled
          slotProps={{
            switch: { disabled: true },
            submitButton: {
              disabled: !formState.isDirty,
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

          <FormCheckbox
            control={form.control}
            name="emailVerificationRequired"
            label="Require Verified Emails"
            helperText="Users must verify their email to be able to sign in."
          />

          <FormCheckbox
            control={form.control}
            name="hibpEnabled"
            label="Password Protection"
            helperText="Passwords must pass haveibeenpwned.com during sign-up."
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
