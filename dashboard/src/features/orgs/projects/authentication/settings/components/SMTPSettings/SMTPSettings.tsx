import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import type { Optional } from 'utility-types';
import * as yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormCheckbox } from '@/components/form/FormCheckbox';
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

const smtpValidationSchema = yup
  .object({
    secure: yup.bool().label('SMTP Secure'),
    host: yup.string().label('SMTP Host').required(),
    port: yup
      .number()
      .typeError('The SMTP port should contain only numbers.')
      .required(),
    user: yup.string().label('Username').required(),
    password: yup.string().label('Password'),
    method: yup.string().required(),
    sender: yup.string().label('SMTP Sender').required(),
  })
  .required();

export type SmtpFormValues = yup.InferType<typeof smtpValidationSchema>;

export default function SMTPSettings() {
  const { project } = useProject();
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data, refetch } = useGetSmtpSettingsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { secure, host, port, user, method, sender, password } =
    data?.config?.provider?.smtp || {};

  const form = useForm<Optional<SmtpFormValues, 'password'>>({
    reValidateMode: 'onSubmit',
    resolver: yupResolver(smtpValidationSchema),
    defaultValues: {
      secure: false,
      host: '',
      port: undefined,
      user: '',
      password: '',
      method: '',
      sender: '',
    },
    values: {
      secure: secure || false,
      host: host || '',
      port,
      user: user || '',
      password: password || '',
      method: method || '',
      sender: sender || '',
    },
    mode: 'onSubmit',
    criteriaMode: 'all',
  });

  const {
    formState: { isDirty, isSubmitting },
  } = form;

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const handleEditSMTPSettings = async (values: SmtpFormValues) => {
    const { password: newPassword, ...valuesWithoutPassword } = values;

    const updateConfigPromise = updateConfig({
      variables: {
        appId: project!.id,
        config: {
          provider: {
            smtp: newPassword ? values : valuesWithoutPassword,
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
        loadingMessage: 'SMTP settings are being updated...',
        successMessage: 'SMTP settings have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update the SMTP settings.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleEditSMTPSettings}>
        <SettingsCard>
          <SettingsCardHeader
            title="SMTP Settings"
            description="Configure your SMTP settings to send emails from your email domain."
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
              name="host"
              label="SMTP Host"
              placeholder="e.g. smtp.sendgrid.net"
              containerClassName="lg:col-span-4"
            />

            <FormInput
              control={form.control}
              name="port"
              type="number"
              label="Port"
              placeholder="587"
              containerClassName="lg:col-span-1"
            />

            <FormInput
              control={form.control}
              name="user"
              label="SMTP Username"
              placeholder="SMTP Username"
              containerClassName="lg:col-span-4"
            />

            <FormInput
              control={form.control}
              name="password"
              type="password"
              label="SMTP Password"
              placeholder="Enter SMTP password"
              containerClassName="lg:col-span-5"
            />

            <FormInput
              control={form.control}
              name="method"
              label="SMTP Auth Method"
              placeholder="LOGIN"
              containerClassName="lg:col-span-4"
            />

            <FormCheckbox
              control={form.control}
              name="secure"
              label="Use SSL"
              containerClassName="lg:col-span-9"
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
