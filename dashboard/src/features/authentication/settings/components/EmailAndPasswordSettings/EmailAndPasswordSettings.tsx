import { useUI } from '@/components/common/UIProvider';
import { ControlledCheckbox } from '@/components/form/ControlledCheckbox';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import {
  GetSignInMethodsDocument,
  useGetSignInMethodsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

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
  const { maintenanceActive } = useUI();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetSignInMethodsDocument],
  });

  const { data, error, loading } = useGetSignInMethodsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-only',
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
        appId: currentProject.id,
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
          docsLink="https://docs.nhost.io/authentication/sign-in-with-email-and-password"
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
