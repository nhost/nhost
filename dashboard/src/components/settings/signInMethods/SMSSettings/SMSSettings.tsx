import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import {
  GetSmsSettingsDocument,
  useSignInMethodsQuery,
  useUpdateAppMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Input from '@/ui/v2/Input';
import Option from '@/ui/v2/Option';
import Select from '@/ui/v2/Select';
import Text from '@/ui/v2/Text';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import Image from 'next/image';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';

export interface SMSSettingsFormValues {
  authSmsTwilioAccountSid: string;
  authSmsTwilioAuthToken: string;
  authSmsTwilioMessagingServiceId: string;
  authSmsPasswordlessEnabled: boolean;
}

export default function SMSSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation({
    refetchQueries: [GetSmsSettingsDocument],
  });

  const { data, loading } = useSignInMethodsQuery({
    variables: {
      id: currentApplication.id,
    },
    fetchPolicy: 'cache-only',
    onError: (error) => {
      throw error;
    },
  });

  const form = useForm<SMSSettingsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      authSmsTwilioAccountSid: data.app.authSmsTwilioAccountSid,
      authSmsTwilioAuthToken: data.app.authSmsTwilioAuthToken,
      authSmsTwilioMessagingServiceId: data.app.authSmsTwilioMessagingServiceId,
      authSmsPasswordlessEnabled: data.app.authSmsPasswordlessEnabled,
    },
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading SMS settings..."
        className="justify-center"
      />
    );
  }

  const { register, formState, watch } = form;
  const authSmsPasswordlessEnabled = watch('authSmsPasswordlessEnabled');

  const handleSMSSettingsChange = async (values: SMSSettingsFormValues) => {
    const updateAppMutation = updateApp({
      variables: {
        id: currentApplication.id,
        app: {
          ...values,
        },
      },
    });

    await toast.promise(
      updateAppMutation,
      {
        loading: `SMS settings are being updated...`,
        success: `SMS settings have been updated successfully.`,
        error: `An error occurred while trying to update SMS settings.`,
      },
      getToastStyleProps(),
    );

    form.reset(values);
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSMSSettingsChange}>
        <SettingsContainer
          title="Phone Number (SMS)"
          description="Allow users to sign in with Phone Number (SMS)."
          primaryActionButtonProps={{
            disabled: !formState.isValid || !formState.isDirty,
            loading: formState.isSubmitting,
          }}
          switchId="authSmsPasswordlessEnabled"
          enabled={authSmsPasswordlessEnabled}
          showSwitch
          docsLink="https://docs.nhost.io/authentication/sign-in-with-phone-number-sms"
          docsTitle="how to sign in users with a phone number (SMS)"
          className={twMerge(
            'grid grid-flow-col grid-cols-2 grid-rows-4 gap-y-4 gap-x-3 px-4 py-2',
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
            {...register('authSmsTwilioAccountSid')}
            name="authSmsTwilioAccountSid"
            id="authSmsTwilioAccountSid"
            placeholder="Account SID"
            className="col-span-2 lg:col-span-1"
            fullWidth
            hideEmptyHelperText
            label="Account SID"
          />
          <Input
            {...register('authSmsTwilioAuthToken')}
            name="authSmsTwilioAuthToken"
            id="authSmsTwilioAuthToken"
            placeholder="Auth Token"
            className="col-span-2 lg:col-span-1"
            fullWidth
            hideEmptyHelperText
            label="Auth Token"
          />
          <Input
            {...register('authSmsTwilioMessagingServiceId')}
            name="authSmsTwilioMessagingServiceId"
            id="authSmsTwilioMessagingServiceId"
            placeholder="Messaging Service ID"
            className="col-span-2 lg:col-span-1"
            fullWidth
            hideEmptyHelperText
            label="Messaging Service ID"
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
