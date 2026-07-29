import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import * as yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetSmtpSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';

const validationSchema = yup
  .object({
    sender: yup.string().label('SMTP Sender').required(),
    password: yup.string().label('Password').required(),
  })
  .required();

export type PostmarkFormValues = yup.InferType<typeof validationSchema>;

export default function PostmarkSettings() {
  const { project } = useProject();
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data, refetch } = useGetSmtpSettingsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { sender, password } = data?.config?.provider?.smtp || {};

  const [updateConfig] = useUpdateConfigMutation({
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
    formState: { isDirty, isSubmitting },
  } = form;

  const handleEditPostmarkSettings = async (values: PostmarkFormValues) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project!.id,
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
        form.reset({ ...values });
        await refetch();

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
        <SettingsCard>
          <SettingsCardHeader
            title="Postmark Settings"
            description="Configure postmark's native integration to send emails from your email domain."
          />

          <SettingsCardContent className="grid-cols-1 lg:grid-cols-9">
            <FormInput
              control={form.control}
              name="sender"
              label="From Email"
              placeholder="noreply@nhost.app"
              containerClassName="lg:col-span-4"
            />

            <FormInput
              control={form.control}
              name="password"
              type="password"
              label="Password"
              placeholder="Enter password"
              containerClassName="lg:col-span-5"
            />
          </SettingsCardContent>

          <SettingsCardFooter>
            <ButtonWithLoading
              type="submit"
              disabled={!isDirty}
              loading={isSubmitting}
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
