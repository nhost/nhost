import ControlledCheckbox from '@/components/common/ControlledCheckbox';
import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import {
  useSignInMethodsQuery,
  useUpdateAppMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import { toastStyleProps } from '@/utils/settings/settingsConstants';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

export interface EmailAndPasswordFormValues {
  /**
   * When enabled, users will need to verify their email by a link sent to their specified email.
   */
  authEmailSigninEmailVerifiedRequired: boolean;
  /**
   * If true, users' passwords will be checked against https://haveibeenpwned.com/Passwords
   */
  authPasswordHibpEnabled: boolean;
}

export default function EmailAndPasswordSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation();

  const { data, error, loading } = useSignInMethodsQuery({
    variables: {
      id: currentApplication.id,
    },
    fetchPolicy: 'cache-only',
  });

  const form = useForm<EmailAndPasswordFormValues>({
    reValidateMode: 'onChange',
    defaultValues: {
      authPasswordHibpEnabled: data.app.authPasswordHibpEnabled || false,
      authEmailSigninEmailVerifiedRequired:
        data.app.authEmailSigninEmailVerifiedRequired || false,
    },
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

  const { formState } = form;

  const handleEmailAndPasswordSettingsChange = async (
    values: EmailAndPasswordFormValues,
  ) => {
    const updateAppMutation = updateApp({
      variables: {
        id: currentApplication.id,
        app: {
          authPasswordHibpEnabled: values.authPasswordHibpEnabled,
          authEmailSigninEmailVerifiedRequired:
            values.authEmailSigninEmailVerifiedRequired,
        },
      },
    });

    await toast.promise(
      updateAppMutation,
      {
        loading: `Email and password sign-in settings are being updated...`,
        success: `Email and password sign-in settings have been updated successfully.`,
        error: `An error occurred while trying to update email sign-in settings.`,
      },
      toastStyleProps,
    );

    form.reset(values);
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleEmailAndPasswordSettingsChange}>
        <SettingsContainer
          title="Email and Password"
          description="Allow users to sign in with email and password."
          docsLink="https://docs.nhost.io/authentication/sign-in-with-email-and-password"
          docsTitle="how to sign in users with email and password"
          className="grid grid-flow-row"
          showSwitch
          enabled
          slotProps={{
            switch: {
              disabled: true,
            },
            submitButton: {
              disabled: !formState.isValid || !formState.isDirty,
              loading: formState.isSubmitting,
            },
          }}
        >
          <ControlledCheckbox
            name="authEmailSigninEmailVerifiedRequired"
            id="authEmailSigninEmailVerifiedRequired"
            label={
              <span className="inline-grid grid-flow-row gap-y-0.5 text-sm+">
                <span className="font-medium">Require Verified Emails</span>
                <span className="font-normal text-greyscaleMedium">
                  Users must verify their email to be able to sign in.
                </span>
              </span>
            }
          />

          <ControlledCheckbox
            name="authPasswordHibpEnabled"
            id="authPasswordHibpEnabled"
            label={
              <span className="inline-grid grid-flow-row gap-y-0.5 text-sm+">
                <span className="font-medium">Password Protection</span>
                <span className="font-normal text-greyscaleMedium">
                  Passwords must pass haveibeenpwned.com during sign-up.
                </span>
              </span>
            }
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
