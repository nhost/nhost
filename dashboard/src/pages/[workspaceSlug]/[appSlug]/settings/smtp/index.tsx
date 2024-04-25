import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { ControlledCheckbox } from '@/components/form/ControlledCheckbox';
import { Form } from '@/components/form/Form';
import { Container } from '@/components/layout/Container';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Input } from '@/components/ui/v2/Input';
import { UpgradeNotification } from '@/features/projects/common/components/UpgradeNotification';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import {
  GetSmtpSettingsDocument,
  useGetSmtpSettingsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import type { ReactElement } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
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

const postmarkValidationSchema = yup
  .object({
    password: yup.string().label('Password').required(),
    sender: yup.string().label('SMTP Sender').email().required(),
  })
  .required();

export type SmtpFormValues = yup.InferType<typeof smtpValidationSchema>;

export type PostmarkFormValues = yup.InferType<typeof postmarkValidationSchema>;

export default function SMTPSettingsPage() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { data, loading, error } = useGetSmtpSettingsQuery({
    variables: { appId: currentProject?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { secure, host, port, user, method, sender, password } =
    data?.config?.provider?.smtp || {};

  const smtpForm = useForm<Optional<SmtpFormValues, 'password'>>({
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
  } = smtpForm;

  const postmarkForm = useForm<Optional<PostmarkFormValues, 'password'>>({
    reValidateMode: 'onSubmit',
    resolver: yupResolver(postmarkValidationSchema),
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
    register: registerPostmark,
    formState: { errors: errorsPostmark, isDirty: isDirtyPostmark, isSubmitting: isSubmittingPostmark },
  } = postmarkForm;

  const deleteForm = useForm({
    reValidateMode: 'onSubmit',
    mode: 'onSubmit',
    criteriaMode: 'all',
  });

  const {
    formState: { isSubmitting: isSubmittingDelete },
  } = deleteForm;

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetSmtpSettingsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (isPlatform && currentProject?.plan?.isFree) {
    return (
      <Container
        className="grid max-w-5xl grid-flow-row gap-4 bg-transparent"
        rootClassName="bg-transparent"
      >
        <UpgradeNotification message="Unlock SMTP settings by upgrading your project to the Pro plan." />
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
    const { password: newPassword, ...valuesWithoutPassword } = values;

    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
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
        loadingMessage: 'SMTP settings are being updated...',
        successMessage: 'SMTP settings have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update the SMTP settings.',
      },
    );
  };

  const handleEditPostmarkSettings = async (values: PostmarkFormValues) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          provider: {
            smtp: {method: 'LOGIN', host: 'postmark', ...values},
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

  const handleDeleteSMTPSettings = async () => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          provider: {
            smtp: null,
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
        loadingMessage: 'SMTP settings are being deleted...',
        successMessage: 'SMTP settings have been deleted successfully.',
        errorMessage:
          'An error occurred while trying to delete the SMTP settings.',
      },
    );
  };

  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-4 bg-transparent"
      rootClassName="bg-transparent"
    >
      <FormProvider {...smtpForm}>
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

      <FormProvider {...postmarkForm}>
        <Form onSubmit={handleEditPostmarkSettings}>
          <SettingsContainer
            title="Postmark Settings"
            description="Configure postmark's native integration to send emails from your email domain."
            submitButtonText="Save"
            className="grid grid-cols-9 gap-4"
            slotProps={{
              submitButton: {
                disabled: !isDirtyPostmark || maintenanceActive,
                loading: isSubmittingPostmark,
              },
            }}
          >
            <Input
              {...registerPostmark('sender')}
              id="sender"
              name="sender"
              label="From Email"
              placeholder="noreply@nhost.app"
              className="lg:col-span-4"
              hideEmptyHelperText
              fullWidth
              error={Boolean(errorsPostmark.sender)}
              helperText={errorsPostmark.sender?.message}
            />

            <Input
              {...registerPostmark('password')}
              id="password"
              label="SMTP Password"
              type="password"
              placeholder="Enter SMTP password"
              className="lg:col-span-5"
              hideEmptyHelperText
              fullWidth
              error={Boolean(errorsPostmark.password)}
              helperText={errorsPostmark.password?.message}
            />
         </SettingsContainer>
        </Form>
      </FormProvider>

      <FormProvider {...deleteForm}>
        <Form onSubmit={handleDeleteSMTPSettings}>
          <SettingsContainer
            title="Delete SMTP Settings"
            description="Delete SMTP settings and revert to default values"
            submitButtonText="Delete"
            className="grid grid-cols-9 gap-4"
            slotProps={{
              submitButton: {
                disabled: maintenanceActive,
                loading: isSubmittingDelete,
              },
            }}
          >
          </SettingsContainer>
        </Form>
      </FormProvider>
    </Container>
  );
}

SMTPSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
