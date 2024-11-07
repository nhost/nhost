import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Input } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { Text } from '@/components/ui/v2/Text';
import {
  useGetSignInMethodsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import Image from 'next/image';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

const validationSchema = Yup.object({
  accountSid: Yup.string()
    .label('Account SID')
    .when('enabled', {
      is: true,
      then: (schema) => schema.required(),
    }),
  authToken: Yup.string()
    .label('Auth Token')
    .when('enabled', {
      is: true,
      then: (schema) => schema.required(),
    }),
  messagingServiceId: Yup.string()
    .label('Messaging Service ID')
    .when('enabled', {
      is: true,
      then: (schema) => schema.required(),
    }),
  enabled: Yup.boolean().label('Enabled'),
});

export type SMSSettingsFormValues = Yup.InferType<typeof validationSchema>;

export default function SMSSettings() {
  const { project } = useProject();
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetSignInMethodsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { accountSid, authToken, messagingServiceId } =
    data?.config?.provider?.sms || {};
  const { enabled } = data?.config?.auth?.method?.smsPasswordless || {};

  const form = useForm<SMSSettingsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      accountSid: accountSid || '',
      authToken: authToken || '',
      messagingServiceId: messagingServiceId || '',
      enabled: enabled || false,
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading) {
      form.reset({
        accountSid: accountSid || '',
        authToken: authToken || '',
        messagingServiceId: messagingServiceId || '',
        enabled: enabled || false,
      });
    }
  }, [loading, accountSid, authToken, messagingServiceId, enabled, form]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading settings for the SMS provider..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { register, formState, watch } = form;
  const authSmsPasswordlessEnabled = watch('enabled');

  const handleSMSSettingsChange = async (values: SMSSettingsFormValues) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project.id,
        config: {
          provider: {
            sms: {
              accountSid: values.accountSid,
              authToken: values.authToken,
              messagingServiceId: values.messagingServiceId,
            },
          },
          auth: {
            method: {
              smsPasswordless: {
                enabled: values.enabled,
              },
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(values);

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
        loadingMessage: 'SMS settings are being updated...',
        successMessage: 'SMS settings have been updated successfully.',
        errorMessage: 'An error occurred while trying to update SMS settings.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSMSSettingsChange}>
        <SettingsContainer
          title="Phone Number (SMS)"
          description="Allow users to sign in with Phone Number (SMS)."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          switchId="enabled"
          showSwitch
          docsLink="https://docs.nhost.io/guides/auth/sign-in-phone-number"
          docsTitle="how to sign in users with a phone number (SMS)"
          className={twMerge(
            'grid grid-flow-col grid-cols-2 grid-rows-4 gap-x-3 gap-y-4 px-4 py-2',
            !authSmsPasswordlessEnabled && 'hidden',
          )}
        >
          <Select
            className="col-span-2 lg:col-span-1"
            variant="normal"
            hideEmptyHelperText
            label="Provider"
            disabled
            value="twilio"
            slotProps={{
              root: {
                slotProps: {
                  buttonLabel: {
                    className: 'grid grid-flow-col items-center gap-1 text-sm+',
                  },
                },
              },
            }}
          >
            <Option value="twilio">
              <Image
                src="/assets/brands/twilio.svg"
                alt="Logo of Twilio"
                width={20}
                height={20}
                layout="fixed"
              />

              <Text>Twilio</Text>
            </Option>
          </Select>
          <Input
            {...register('accountSid')}
            name="accountSid"
            id="accountSid"
            placeholder="Account SID"
            className="col-span-2 lg:col-span-1"
            fullWidth
            hideEmptyHelperText
            label="Account SID"
            error={!!formState.errors?.accountSid}
            helperText={formState.errors?.accountSid?.message}
          />
          <Input
            {...register('authToken')}
            name="authToken"
            id="authToken"
            placeholder="Auth Token"
            className="col-span-2 lg:col-span-1"
            fullWidth
            hideEmptyHelperText
            label="Auth Token"
            error={!!formState.errors?.authToken}
            helperText={formState.errors?.authToken?.message}
          />
          <Input
            {...register('messagingServiceId')}
            name="messagingServiceId"
            id="messagingServiceId"
            placeholder="Messaging Service ID"
            className="col-span-2 lg:col-span-1"
            fullWidth
            hideEmptyHelperText
            label="Messaging Service ID"
            error={!!formState.errors?.messagingServiceId}
            helperText={formState.errors?.messagingServiceId?.message}
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
