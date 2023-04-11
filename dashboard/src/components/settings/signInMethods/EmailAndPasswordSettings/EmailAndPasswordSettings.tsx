import ControlledCheckbox from '@/components/common/ControlledCheckbox';
import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import { useUI } from '@/context/UIContext';
import {
  GetSignInMethodsDocument,
  useGetSignInMethodsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndProject } from '@/hooks/v2/useCurrentWorkspaceAndProject';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Text from '@/ui/v2/Text';
import getServerError from '@/utils/settings/getServerError';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  emailVerificationRequired: Yup.boolean(),
  hibpEnabled: Yup.boolean(),
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

  const { hibpEnabled, emailVerificationRequired } =
    data?.config?.auth?.method?.emailPassword || {};

  const form = useForm<EmailAndPasswordFormValues>({
    reValidateMode: 'onChange',
    defaultValues: {
      hibpEnabled: hibpEnabled || false,
      emailVerificationRequired: emailVerificationRequired || false,
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

  const { formState } = form;

  const handleEmailAndPasswordSettingsChange = async (
    values: EmailAndPasswordFormValues,
  ) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          auth: {
            method: {
              emailPassword: values,
            },
          },
        },
      },
    });

    try {
      await toast.promise(
        updateConfigPromise,
        {
          loading: `Email and password sign-in settings are being updated...`,
          success: `Email and password sign-in settings have been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update email sign-in settings.`,
          ),
        },
        getToastStyleProps(),
      );

      form.reset(values);
    } catch {
      // Note: The toast will handle the error.
    }
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
            switch: { disabled: true },
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
        >
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
