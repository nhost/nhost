import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { ControlledSwitch } from '@/components/form/ControlledSwitch';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Text } from '@/components/ui/v2/Text';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetAuthenticationSettingsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';

const validationSchema = Yup.object({
  disableSignUps: Yup.boolean().required(),
  disableNewUsers: Yup.boolean().required(),
  disableAutoSignup: Yup.boolean().required(),
});

export type UserCreationFormValues = Yup.InferType<typeof validationSchema>;

const toggles: Array<{
  name: keyof UserCreationFormValues;
  title: string;
  description: string;
}> = [
  {
    name: 'disableSignUps',
    title: 'Disable Sign Ups',
    description:
      "Block every sign-up endpoint. Existing users can still sign in, but new user records can't be created through the API.",
  },
  {
    name: 'disableNewUsers',
    title: 'Disable New Users',
    description:
      "Let users register as usual, but mark every new account as disabled. Users can't sign in until an admin enables them.",
  },
  {
    name: 'disableAutoSignup',
    title: 'Disable Auto Sign Up',
    description:
      'Stop sign-in endpoints from auto-creating users. Clients must call a dedicated sign-up endpoint to register.',
  },
];

export default function UserCreationSettings() {
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

  const signUp = data?.config?.auth?.signUp;

  const form = useForm<UserCreationFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      disableSignUps: !signUp?.enabled,
      disableNewUsers: !!signUp?.disableNewUsers,
      disableAutoSignup: !!signUp?.disableAutoSignup,
    },
  });

  useEffect(() => {
    if (!loading) {
      form.reset({
        disableSignUps: !signUp?.enabled,
        disableNewUsers: !!signUp?.disableNewUsers,
        disableAutoSignup: !!signUp?.disableAutoSignup,
      });
    }
  }, [loading, signUp, form]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading user creation settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState } = form;

  const handleSubmit = async (values: UserCreationFormValues) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project!.id,
        config: {
          auth: {
            signUp: {
              enabled: !values.disableSignUps,
              disableNewUsers: values.disableNewUsers,
              disableAutoSignup: values.disableAutoSignup,
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
        loadingMessage: 'Updating user creation settings...',
        successMessage:
          'User creation settings have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update user creation settings.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Controlling User Creation"
          description="Configure whether, when, and how users can register for your app."
          docsLink="https://docs.nhost.io/products/auth/controlling-user-creation"
          docsTitle="controlling user creation"
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          className="grid grid-flow-row gap-0"
        >
          {toggles.map((toggle, index) => (
            <div
              key={toggle.name}
              className={`flex items-start justify-between gap-6 py-4 ${
                index === 0 ? 'pt-0' : 'border-t'
              }`}
            >
              <div className="grid grid-flow-row gap-1">
                <Text className="font-medium">{toggle.title}</Text>
                <Text color="secondary">{toggle.description}</Text>
              </div>
              <ControlledSwitch
                name={toggle.name}
                id={toggle.name}
                className="self-center"
              />
            </div>
          ))}
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
