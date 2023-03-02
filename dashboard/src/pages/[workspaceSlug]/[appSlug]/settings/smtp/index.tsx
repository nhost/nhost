import { UnlockFeatureByUpgrading } from '@/components/applications/UnlockFeatureByUpgrading';
import ControlledCheckbox from '@/components/common/ControlledCheckbox';
import Form from '@/components/common/Form';
import Container from '@/components/layout/Container';
import SettingsContainer from '@/components/settings/SettingsContainer';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { useUI } from '@/context/UIContext';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Input from '@/ui/v2/Input';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import {
  GetSmtpSettingsDocument,
  useGetSmtpSettingsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import type { ReactElement } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import type { Optional } from 'utility-types';
import * as yup from 'yup';

const smtpValidationSchema = yup
  .object({
    secure: yup.bool().label('SMTP Secure'),
    host: yup
      .string()
      .label('SMTP Host')
      .matches(
        /((https?):\/\/)?(www.)?[a-z0-9]+(\.[a-z]{2,}){1,3}(#?\/?[a-zA-Z0-9#]+)*\/?(\?[a-zA-Z0-9-_]+=[a-zA-Z0-9-%]+&?)?$/,
        'SMTP Host must be a valid URL',
      )
      .required(),
    port: yup
      .number()
      .typeError('The SMTP port should contain only numbers.')
      .required(),
    user: yup.string().label('Username').required(),
    password: yup.string().label('Password'),
    method: yup.string().required(),
    sender: yup.string().label('SMTP Sender').email().required(),
  })
  .required();

export type SmtpFormValues = yup.InferType<typeof smtpValidationSchema>;

export default function SMTPSettingsPage() {
  const { maintenanceActive } = useUI();
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const { data, loading, error } = useGetSmtpSettingsQuery({
    variables: { appId: currentApplication?.id },
  });

  const { secure, host, port, user, method, sender } =
    data?.config?.provider?.smtp || {};

  const form = useForm<Optional<SmtpFormValues, 'password'>>({
    reValidateMode: 'onSubmit',
    resolver: yupResolver(smtpValidationSchema),
    defaultValues: {
      secure: false,
      host: '',
      port: undefined,
      user: '',
      method: '',
      sender: '',
    },
    values: {
      secure: secure || false,
      host: host || '',
      port,
      user: user || '',
      method: method || '',
      sender: sender || '',
    },
    mode: 'onSubmit',
    criteriaMode: 'all',
  });

  const {
    register,
    formState: { errors, isDirty, isSubmitting },
  } = form;

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetSmtpSettingsDocument],
  });

  if (currentApplication.plan.isFree) {
    return (
      <Container
        className="grid max-w-5xl grid-flow-row gap-4 bg-transparent"
        rootClassName="bg-transparent"
      >
        <UnlockFeatureByUpgrading
          message="Unlock SMTP settings by upgrading your project to the Pro plan."
          className="mt-4"
        />
      </Container>
    );
  }

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading SMTP settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const handleEditSMTPSettings = async (values: SmtpFormValues) => {
    const { password, ...valuesWithoutPassword } = values;

    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentApplication.id,
        config: {
          provider: {
            smtp: password ? values : valuesWithoutPassword,
          },
        },
      },
    });

    try {
      await toast.promise(
        updateConfigPromise,
        {
          loading: `SMTP settings are being updated...`,
          success: `SMTP settings have been updated successfully.`,
          error: (arg: Error) =>
            arg?.message
              ? `Error: ${arg.message}`
              : `An error occurred while trying to update the SMTP settings.`,
        },
        getToastStyleProps(),
      );
    } catch {
      // Note: The toast will handle the error.
    }
  };

  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-4 bg-transparent"
      rootClassName="bg-transparent"
    >
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
              {...register('host')}
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
              {...register('port')}
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
              {...register('user')}
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
              {...register('password')}
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
              {...register('method')}
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
    </Container>
  );
}

SMTPSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
