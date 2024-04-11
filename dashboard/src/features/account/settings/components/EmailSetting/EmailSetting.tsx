import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Input } from '@/components/ui/v2/Input';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useNhostClient, useUserData } from '@nhost/nextjs';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  email: Yup.string().label('Email').email().required(),
});

export type EmailSettingFormValues = Yup.InferType<typeof validationSchema>;

export default function EmailSetting() {
  const nhost = useNhostClient();
  const { email } = useUserData();

  const form = useForm<EmailSettingFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: { email },
    resolver: yupResolver(validationSchema),
  });

  const { register, formState } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  async function handleSubmit(formValues: EmailSettingFormValues) {
    await execPromiseWithErrorToast(
      async () => {
        await nhost.auth.changeEmail({
          newEmail: formValues.email,
          options: {
            redirectTo: `${window.location.origin}/account`,
          },
        });
        form.reset({ email: formValues.email });
      },
      {
        loadingMessage: 'Updating your email...',
        successMessage:
          'Please check your inbox. Follow the link to finalize changing your email.',
        errorMessage:
          'An error occurred while trying to update your email. Please try again.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Update your email"
          slotProps={{
            submitButton: {
              disabled: !isDirty,
              loading: formState.isSubmitting,
            },
          }}
          className="grid grid-flow-row lg:grid-cols-5"
        >
          <Input
            {...register('email')}
            className="col-span-2"
            id="email"
            spellCheck="false"
            autoCapitalize="none"
            type="email"
            label="Email"
            hideEmptyHelperText
            fullWidth
            helperText={formState.errors.email?.message}
            error={Boolean(formState.errors.email)}
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
