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

const validationSchema = Yup.object({
  displayName: Yup.string()
    .label('Display Name')
    .required('This field is required.'),
});

export type DisplayNameSettingFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function DisplayNameSetting() {
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
        await updateUserDisplayName({
          variables: {
            id: userID,
            displayName: formValues.displayName,
          },
        });

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
