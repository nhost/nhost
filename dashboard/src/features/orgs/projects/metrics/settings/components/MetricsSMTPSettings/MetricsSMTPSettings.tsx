import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Input } from '@/components/ui/v2/Input';
import {
  GetSmtpSettingsDocument,
  useGetObservabilitySettingsQuery,
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
    host: yup.string().label('SMTP Host').required(),
    port: yup
      .number()
      .typeError('The SMTP port should contain only numbers.')
      .required(),
    user: yup.string().label('Username').required(),
    password: yup.string().label('Password'),
    sender: yup.string().label('SMTP Sender').required(),
  })
  .required();

export type MetricsSmtpFormValues = yup.InferType<typeof smtpValidationSchema>;

export default function MetricsSMTPSettings() {
  const { maintenanceActive } = useUI();
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();

  const { data } = useGetObservabilitySettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { host, port, user, sender, password } =
    data?.config?.observability?.grafana?.smtp || {};

  const form = useForm<Optional<MetricsSmtpFormValues, 'password'>>({
    reValidateMode: 'onSubmit',
    resolver: yupResolver(smtpValidationSchema),
    defaultValues: {
      host: '',
      port: undefined,
      user: '',
      password: '',
      sender: '',
    },
    values: {
      host: host || '',
      port,
      user: user || '',
      password: password || '',
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
    refetchQueries: [GetSmtpSettingsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const handleEditSMTPSettings = async (values: MetricsSmtpFormValues) => {
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
        loadingMessage: 'Metrics SMTP settings are being updated...',
        successMessage: 'Metrics SMTP settings have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update the Metrics SMTP settings.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleEditSMTPSettings}>
        <SettingsContainer
          title="SMTP Settings"
          description="Configure your SMTP settings to send emails as part of your alerting."
          docsLink="https://docs.nhost.io/platform/metrics#smtp"
          submitButtonText="Save"
          className="grid gap-4 lg:grid-cols-9"
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
            placeholder="admin@localhost"
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
            placeholder="localhost"
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
            placeholder="25"
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
            placeholder="Enter SMTP Username"
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
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
