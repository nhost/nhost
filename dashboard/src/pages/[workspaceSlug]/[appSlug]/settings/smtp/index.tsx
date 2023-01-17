import { UnlockFeatureByUpgrading } from '@/components/applications/UnlockFeatureByUpgrading';
import ControlledCheckbox from '@/components/common/ControlledCheckbox';
import Form from '@/components/common/Form';
import Container from '@/components/layout/Container';
import SettingsContainer from '@/components/settings/SettingsContainer';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Input from '@/ui/v2/Input';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import {
  useGetSmtpSettingsQuery,
  useUpdateAppMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import type { Optional } from 'utility-types';
import * as yup from 'yup';

const settingsSMTPValidationSchema = yup
  .object({
    AuthSmtpSecure: yup.bool().label('SMTP Secure'),
    authSmtpHost: yup
      .string()
      .label('SMTP Host')
      .matches(
        /((https?):\/\/)?(www.)?[a-z0-9]+(\.[a-z]{2,}){1,3}(#?\/?[a-zA-Z0-9#]+)*\/?(\?[a-zA-Z0-9-_]+=[a-zA-Z0-9-%]+&?)?$/,
        'The SMTP host must be a valid URL.',
      )
      .required(),
    authSmtpPort: yup
      .number()
      .typeError('The SMTP port should contain only numbers.')
      .required(),
    authSmtpUser: yup.string().label('The SMTP Username').required(),
    authSmtpPass: yup.string().label('The SMTP Password'),
    AuthSmtpAuthMethod: yup.string().required(),
    authSmtpSender: yup
      .string()
      .label('The SMTP Sender')
      .email('The sender address should be a valid email.')
      .required(),
  })
  .required();

export type SettingsSMTPValidationSchemaFormData = yup.InferType<
  typeof settingsSMTPValidationSchema
>;

export default function SMTPSettingsPage() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const { data, loading, error } = useGetSmtpSettingsQuery({
    variables: {
      id: currentApplication.id,
    },
  });

  const form = useForm<
    Optional<SettingsSMTPValidationSchemaFormData, 'authSmtpPass'>
  >({
    reValidateMode: 'onSubmit',
    resolver: yupResolver(settingsSMTPValidationSchema),
    defaultValues: {
      AuthSmtpSecure: data?.app?.AuthSmtpSecure,
      authSmtpHost: data?.app?.authSmtpHost,
      authSmtpPort: data?.app?.authSmtpPort,
      authSmtpUser: data?.app?.authSmtpUser,
      AuthSmtpAuthMethod: data?.app.AuthSmtpAuthMethod,
      authSmtpSender: data?.app.authSmtpSender,
    },
    mode: 'onSubmit',
    criteriaMode: 'all',
  });

  useEffect(() => {
    form.reset(() => ({
      AuthSmtpSecure: data?.app?.AuthSmtpSecure || false,
      authSmtpHost: data?.app?.authSmtpHost,
      authSmtpPort: data?.app?.authSmtpPort,
      authSmtpUser: data?.app?.authSmtpUser,
      AuthSmtpAuthMethod: data?.app.AuthSmtpAuthMethod,
      authSmtpSender: data?.app.authSmtpSender,
    }));
  }, [data?.app, form, form.reset]);

  const {
    register,
    formState: { errors, isDirty, isValid },
  } = form;

  const [updateApp, { loading: loadingUpdateAppMutation }] =
    useUpdateAppMutation({
      refetchQueries: ['getSMTPSettings'],
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

  const handleEditSMTPSettings = async ({
    authSmtpSender,
    authSmtpHost,
    authSmtpPass,
    authSmtpPort,
    authSmtpUser,
    AuthSmtpAuthMethod,
    AuthSmtpSecure,
  }: SettingsSMTPValidationSchemaFormData) => {
    const dataInputWithoutPass = {
      authSmtpSender,
      authSmtpUser,
      authSmtpHost,
      authSmtpPort,
      AuthSmtpSecure,
      AuthSmtpAuthMethod,
    };

    const updateAppMutation = updateApp({
      variables: {
        id: currentApplication.id,
        app: authSmtpPass
          ? { ...dataInputWithoutPass, authSmtpPass }
          : dataInputWithoutPass,
      },
    });

    await toast.promise(
      updateAppMutation,
      {
        loading: `SMTP settings are being updated...`,
        success: `SMTP settings updated successfully`,
        error: `Error while updating SMTP settings`,
      },
      getToastStyleProps(),
    );
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
            primaryActionButtonProps={{
              loading: loadingUpdateAppMutation,
              disabled:
                !isValid ||
                !isDirty ||
                (errors && Object.keys(errors).length > 0),
            }}
            className="grid grid-cols-9 gap-4"
          >
            <Input
              {...register('authSmtpSender')}
              id="authSmtpSender"
              name="authSmtpSender"
              label="From Email"
              placeholder="noreply@nhost.app"
              className="lg:col-span-4"
              hideEmptyHelperText
              fullWidth
              error={Boolean(errors.authSmtpSender)}
              helperText={errors.authSmtpSender?.message}
            />

            <Input
              {...register('authSmtpHost')}
              id="authSmtpHost"
              name="authSmtpHost"
              label="SMTP Host"
              className="lg:col-span-4"
              placeholder="e.g. smtp.sendgrid.net"
              hideEmptyHelperText
              fullWidth
              error={Boolean(errors.authSmtpHost)}
              helperText={errors.authSmtpHost?.message}
            />

            <Input
              {...register('authSmtpPort')}
              id="authSmtpPort"
              name="authSmtpPort"
              label="Port"
              type="number"
              placeholder="587"
              className="lg:col-span-1"
              hideEmptyHelperText
              fullWidth
              error={Boolean(errors.authSmtpPort)}
              helperText={errors.authSmtpPort?.message}
            />

            <Input
              {...register('authSmtpUser')}
              id="authSmtpUser"
              label="SMTP Username"
              placeholder="SMTP Username"
              className="lg:col-span-4"
              hideEmptyHelperText
              fullWidth
              error={Boolean(errors.authSmtpUser)}
              helperText={errors.authSmtpUser?.message}
            />

            <Input
              {...register('authSmtpPass')}
              id="authSmtpPass"
              label="SMTP Password"
              type="password"
              placeholder="Enter SMTP password"
              className="lg:col-span-5"
              hideEmptyHelperText
              fullWidth
              error={Boolean(errors.authSmtpPass)}
              helperText={errors.authSmtpPass?.message}
            />

            <Input
              {...register('AuthSmtpAuthMethod')}
              id="AuthSmtpAuthMethod"
              name="AuthSmtpAuthMethod"
              label="SMTP Auth Method"
              placeholder="LOGIN"
              hideEmptyHelperText
              className="lg:col-span-4"
              fullWidth
              error={Boolean(errors.AuthSmtpAuthMethod)}
              helperText={errors.AuthSmtpAuthMethod?.message}
            />

            <ControlledCheckbox
              name="AuthSmtpSecure"
              id="AuthSmtpSecure"
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
