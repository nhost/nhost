import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { ControlledCheckbox } from '@/components/form/ControlledCheckbox';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Input } from '@/components/ui/v2/Input';
import {
  useGetSmtpSettingsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { type Optional } from 'utility-types';
import * as yup from 'yup';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

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
  const { maintenanceActive } = useUI();
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
    register: registerSmtp,
    formState: { errors, isDirty, isSubmitting },
  } = form;

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const handleEditSMTPSettings = async (values: SmtpFormValues) => {
    const { password: newPassword, ...valuesWithoutPassword } = values;

    const updateConfigPromise = updateConfig({
      variables: {
        appId: project.id,
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
        <SettingsContainer
          title="SMTP Settings"
          description="Configure your SMTP settings to send emails from your email domain."
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
            {...registerSmtp('sender')}
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
            {...registerSmtp('host')}
            id="host"
            name="host"
            label="SMTP Host"
            className="lg:col-span-4"
            placeholder="e.g. smtp.sendgrid.net"
            hideEmptyHelperText
            fullWidth
            error={Boolean(errors.host)}
            helperText={errors.host?.message}
          />

          <Input
            {...registerSmtp('port')}
            id="port"
            name="port"
            label="Port"
            type="number"
            placeholder="587"
            className="lg:col-span-1"
            hideEmptyHelperText
            fullWidth
            error={Boolean(errors.port)}
            helperText={errors.port?.message}
          />

          <Input
            {...registerSmtp('user')}
            id="user"
            label="SMTP Username"
            placeholder="SMTP Username"
            className="lg:col-span-4"
            hideEmptyHelperText
            fullWidth
            error={Boolean(errors.user)}
            helperText={errors.user?.message}
          />

          <Input
            {...registerSmtp('password')}
            id="password"
            label="SMTP Password"
            type="password"
            placeholder="Enter SMTP password"
            className="lg:col-span-5"
            hideEmptyHelperText
            fullWidth
            error={Boolean(errors.password)}
            helperText={errors.password?.message}
          />

          <Input
            {...registerSmtp('method')}
            id="method"
            name="method"
            label="SMTP Auth Method"
            placeholder="LOGIN"
            hideEmptyHelperText
            className="lg:col-span-4"
            fullWidth
            error={Boolean(errors.method)}
            helperText={errors.method?.message}
          />

          <ControlledCheckbox
            name="secure"
            id="secure"
            label="Use SSL"
            className="lg:col-span-9"
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
