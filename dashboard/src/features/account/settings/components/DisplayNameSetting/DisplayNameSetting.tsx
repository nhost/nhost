import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { FormInput } from '@/components/form/FormInput';
import { SettingsCardHeader } from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { AccountSettingsCard } from '@/features/account/settings/components/AccountSettingsCard';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useUpdateUserDisplayNameMutation } from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { useNhostClient } from '@/providers/nhost';

const validationSchema = Yup.object({
  displayName: Yup.string()
    .label('Display name')
    .required('This field is required.'),
});

export type DisplayNameSettingFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function DisplayNameSetting() {
  const user = useUserData();
  const nhost = useNhostClient();

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
        await updateUserDisplayName({
          variables: {
            id: userID,
            displayName: formValues.displayName,
          },
        });

        const session = nhost.getUserSession();
        if (session?.user && session.user.id === userID) {
          nhost.sessionStorage.set({
            ...session,
            user: { ...session.user, displayName: formValues.displayName },
          });
        }

        form.reset({ displayName: formValues.displayName });
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
          <SettingsCardHeader
            title="Display name"
            control={
              <ButtonWithLoading
                type="submit"
                disabled={!form.formState.isDirty}
                loading={form.formState.isSubmitting}
                className="w-full sm:w-auto"
              >
                Save
              </ButtonWithLoading>
            }
          >
            <FormInput
              control={form.control}
              name="displayName"
              aria-label="Display name"
              containerClassName="w-full sm:w-96"
            />
          </SettingsCardHeader>
        </form>
      </AccountSettingsCard>
    </Form>
  );
}
