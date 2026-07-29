import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import type { Optional } from 'utility-types';
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
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  GetSmtpSettingsDocument,
  useGetObservabilitySettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';

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
    control,
    formState: { isDirty, isSubmitting },
  } = form;

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetSmtpSettingsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const handleEditSMTPSettings = async (values: MetricsSmtpFormValues) => {
    const { password: newPassword, ...valuesWithoutPassword } = values;

    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
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
        <SettingsCard>
          <SettingsCardHeader
            title="SMTP Settings"
            description="Configure your SMTP settings to send emails as part of your alerting."
          />

          <SettingsCardContent className="lg:grid-cols-9">
            <FormInput
              control={control}
              name="sender"
              label="From Email"
              placeholder="admin@localhost"
              containerClassName="lg:col-span-4"
            />

            <FormInput
              control={control}
              name="host"
              label="SMTP Host"
              placeholder="localhost"
              containerClassName="lg:col-span-4"
            />

            <FormInput
              control={control}
              name="port"
              label="Port"
              placeholder="25"
              type="number"
              containerClassName="lg:col-span-1"
            />

            <FormInput
              control={control}
              name="user"
              label="SMTP Username"
              placeholder="Enter SMTP Username"
              containerClassName="lg:col-span-4"
            />

            <FormInput
              control={control}
              name="password"
              label="SMTP Password"
              placeholder="Enter SMTP password"
              type="password"
              containerClassName="lg:col-span-5"
            />
          </SettingsCardContent>

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://docs.nhost.io/platform/cloud/metrics#smtp"
              title="SMTP Settings"
            />

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
