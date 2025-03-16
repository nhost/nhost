import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Input } from '@/components/ui/v2/Input';
import { useUpdateUserDisplayNameMutation } from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useUserData } from '@nhost/nextjs';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  displayName: Yup.string()
    .label('Display Name')
    .required('This field is required.'),
});

export type DisplayNameSettingFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function DisplayNameSetting() {
  const { id: userID, displayName } = useUserData();

  const [updateUserDisplayName] = useUpdateUserDisplayNameMutation();

  const form = useForm<DisplayNameSettingFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      displayName,
    },
    resolver: yupResolver(validationSchema),
  });

  const { register, formState } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

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
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Update your display name"
          slotProps={{
            submitButton: {
              disabled: !isDirty,
              loading: formState.isSubmitting,
            },
          }}
          className="grid grid-flow-row lg:grid-cols-5"
        >
          <Input
            {...register('displayName')}
            className="col-span-2"
            type="text"
            id="display-name"
            label="Display Name"
            fullWidth
            helperText={formState.errors.displayName?.message}
            error={Boolean(formState.errors.displayName)}
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
