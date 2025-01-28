import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Input } from '@/components/ui/v2/Input';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import {
  GetSmtpSettingsDocument,
  useGetSmtpSettingsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import * as yup from 'yup';

const validationSchema = yup
  .object({
    sender: yup.string().label('SMTP Sender').email().required(),
    password: yup.string().label('Password').required(),
  })
  .required();

export type PostmarkFormValues = yup.InferType<typeof validationSchema>;

export default function PostmarkSettings() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { data } = useGetSmtpSettingsQuery({
    variables: { appId: currentProject?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { sender, password } = data?.config?.provider?.smtp || {};

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetSmtpSettingsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const form = useForm<PostmarkFormValues>({
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
    defaultValues: {
      password: '',
      sender: '',
    },
    values: {
      password: password || '',
      sender: sender || '',
    },
    mode: 'onSubmit',
    criteriaMode: 'all',
  });

  const {
    register,
    formState: { errors, isDirty, isSubmitting },
  } = form;

  const handleEditPostmarkSettings = async (values: PostmarkFormValues) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          provider: {
            smtp: { method: 'LOGIN', host: 'postmark', ...values },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;

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
        loadingMessage: 'Postmark settings are being updated...',
        successMessage: 'Postmark settings have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update your Postmark settings.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleEditPostmarkSettings}>
        <SettingsContainer
          title="Postmark Settings"
          description="Configure postmark's native integration to send emails from your email domain."
          submitButtonText="Save"
          className="grid grid-cols-9 gap-4"
          slotProps={{
            submitButton: {
              disabled: !isDirty || maintenanceActive,
              loading: isSubmitting,
            },
          }}
        >
          <Input
            {...register('sender')}
            id="sender"
            name="sender"
            label="From Email"
            placeholder="noreply@nhost.app"
            className="lg:col-span-4"
            hideEmptyHelperText
            fullWidth
            error={Boolean(errors.sender)}
            helperText={errors.sender?.message}
          />

          <Input
            {...register('password')}
            id="password"
            label="Password"
            type="password"
            placeholder="Enter password"
            className="lg:col-span-5"
            hideEmptyHelperText
            fullWidth
            error={Boolean(errors.password)}
            helperText={errors.password?.message}
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
