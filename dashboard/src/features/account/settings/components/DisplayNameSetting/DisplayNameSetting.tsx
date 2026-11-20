import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { FormInput } from '@/components/form/FormInput';
import {
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { AccountSettingsCard } from '@/features/account/settings/components/AccountSettingsCard';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useUpdateUserDisplayNameMutation } from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { useNhostClient } from '@/providers/nhost';

const validationSchema = Yup.object({
  displayName: Yup.string()
    .label('Display Name')
    .required('This field is required.'),
});

export type DisplayNameSettingFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function DisplayNameSetting() {
  const nhost = useNhostClient();
  const user = useUserData();

  const { id: userID, displayName } = user || {};

  const [updateUserDisplayName] = useUpdateUserDisplayNameMutation();

  const form = useForm<DisplayNameSettingFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      displayName: displayName ?? '',
    },
    resolver: yupResolver(validationSchema),
  });

  async function handleSubmit(formValues: DisplayNameSettingFormValues) {
    await execPromiseWithErrorToast(
      async () => {
        if (!userID) {
          throw new Error('Please sign in again to update your display name.');
        }

        const { data } = await updateUserDisplayName({
          variables: {
            id: userID,
            displayName: formValues.displayName,
          },
        });
        const updatedUser = data?.updateUser;

        if (!updatedUser || updatedUser.id !== userID) {
          throw new Error(
            'Your display name could not be updated. Please try again.',
          );
        }

        const currentSession = nhost.getUserSession();
        if (currentSession?.user && currentSession.user.id === updatedUser.id) {
          nhost.sessionStorage.set({
            ...currentSession,
            user: {
              ...currentSession.user,
              displayName: updatedUser.displayName,
            },
          });
        }

        form.reset({ displayName: updatedUser.displayName });
      },
      {
        loadingMessage: 'Updating your display name...',
        successMessage: 'Your display name has been updated successfully.',
        errorMessage:
          'An error occurred while trying to update your display name. Please try again.',
      },
    );
  }

  return (
    <Form {...form}>
      <AccountSettingsCard asChild>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <SettingsCardHeader title="Update your display name" />

          <SettingsCardContent className="lg:grid-cols-5">
            <FormInput
              control={form.control}
              name="displayName"
              label="Display Name"
              containerClassName="col-span-2"
            />
          </SettingsCardContent>

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
        </form>
      </AccountSettingsCard>
    </Form>
  );
}
