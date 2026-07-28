import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { FormField } from '@/components/ui/v3/form';
import { Switch } from '@/components/ui/v3/switch';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetAuthenticationSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';

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
        <SettingsCard>
          <SettingsCardHeader
            title="Controlling User Creation"
            description="Configure whether, when, and how users can register for your app."
          />

          <SettingsCardContent className="gap-0">
            {toggles.map((toggle, index) => (
              <div
                key={toggle.name}
                className={`flex items-start justify-between gap-6 py-4 ${
                  index === 0 ? 'pt-0' : 'border-t'
                }`}
              >
                <div className="grid grid-flow-row gap-1">
                  <p className="font-medium">{toggle.title}</p>
                  <p className="text-muted-foreground">{toggle.description}</p>
                </div>
                <FormField
                  control={form.control}
                  name={toggle.name}
                  render={({ field }) => (
                    <Switch
                      id={toggle.name}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="self-center"
                      aria-label={`Toggle ${toggle.title}`}
                    />
                  )}
                />
              </div>
            ))}
          </SettingsCardContent>

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://docs.nhost.io/products/auth/controlling-user-creation"
              title="controlling user creation"
            />

            <ButtonWithLoading
              type="submit"
              disabled={!formState.isDirty}
              loading={formState.isSubmitting}
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
