import ErrorBoundaryFallback from '@/components/common/ErrorBoundaryFallback';
import TwilioIcon from '@/components/icons/TwilioIcon';
import {
  useGetSmsSettingsQuery,
  useUpdateAppMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Button, Input } from '@/ui';
import { Alert } from '@/ui/Alert';
import DelayedLoading from '@/ui/DelayedLoading';
import { Text } from '@/ui/Text';
import { showLoadingToast, triggerToast } from '@/utils/toast';
import { useApolloClient } from '@apollo/client';
import { useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
} from 'react-hook-form';
import toast from 'react-hot-toast';

export function EditSMSSettingsForm({
  close,
  isAlreadyEnabled,
}: {
  close: () => void;
  isAlreadyEnabled: boolean;
}) {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const {
    handleSubmit,
    watch,
    formState: { isSubmitting, errors },
  } = useFormContext<EditSMSSettingsFormData>();
  const { control } = useFormContext<EditSMSSettingsFormData>();

  const [updateApp] = useUpdateAppMutation();
  let toastId: string;

  const client = useApolloClient();
  const isNotCompleted =
    !watch('accountSID') ||
    !watch('authToken') ||
    !watch('messagingServiceSID');

  const handleEditSMSSettings = async (data: EditSMSSettingsFormData) => {
    try {
      toastId = showLoadingToast('Updating SMS settings...');
      await updateApp({
        variables: {
          id: currentApplication.id,
          app: {
            authSmsTwilioAccountSid: data.accountSID,
            authSmsTwilioAuthToken: data.authToken,
            authSmsTwilioMessagingServiceId: data.messagingServiceSID,
            authSmsPasswordlessEnabled: true,
          },
        },
      });
      await client.refetchQueries({ include: ['getSMSSettings'] });
      toast.remove(toastId);
      triggerToast('SMS settings updated successfully.');
      close();
    } catch (error) {
      if (toastId) {
        toast.remove(toastId);
      }
      throw error;
    }
  };

  return (
    <form
      onSubmit={handleSubmit(handleEditSMSSettings)}
      className="flex w-full flex-col pb-1"
      autoComplete="off"
    >
      {errors &&
        Object.entries(errors).map(([type, error]) => (
          <Alert key={type} className="mb-4" severity="error">
            {error.message}
          </Alert>
        ))}

      <div>
        <div className="flex flex-row place-content-between border-t border-b px-2 py-2.5">
          <div className="flex w-full flex-row">
            <Text
              color="greyscaleDark"
              className="self-center font-medium"
              size="normal"
            >
              Account SID
            </Text>
          </div>
          <div className="flex w-full">
            <Controller
              name="accountSID"
              control={control}
              rules={{
                required: true,
                pattern: {
                  value: /^[a-zA-Z0-9-_]+$/,
                  message:
                    'The Account SID must contain only letters, hyphens, and numbers.',
                },
              }}
              render={({ field }) => (
                <Input
                  {...field}
                  id="accountSID"
                  placeholder="Account SID"
                  required
                  value={field.value || ''}
                  onChange={(value: string) => {
                    if (value && !/^[a-zA-Z0-9-_]+$/gi.test(value)) {
                      // prevent the user from entering invalid characters
                      return;
                    }

                    field.onChange(value);
                  }}
                />
              )}
            />
          </div>
        </div>
        <div className="flex flex-row place-content-between border-b px-2 py-2.5">
          <div className="flex w-full flex-row">
            <Text
              color="greyscaleDark"
              className="self-center font-medium"
              size="normal"
            >
              Auth Token
            </Text>
          </div>
          <div className="flex w-full">
            <Controller
              name="authToken"
              control={control}
              rules={{
                required: true,
                pattern: {
                  value: /^[a-zA-Z0-9-_]+$/,
                  message:
                    'The Auth Token must contain only letters, hyphens, and numbers.',
                },
              }}
              render={({ field }) => (
                <Input
                  {...field}
                  id="authToken"
                  placeholder="Auth Token"
                  required
                  value={field.value || ''}
                  onChange={(value: string) => {
                    if (value && !/^[a-zA-Z0-9-_/.]+$/gi.test(value)) {
                      return;
                    }

                    field.onChange(value);
                  }}
                />
              )}
            />
          </div>
        </div>
        <div className="flex flex-row place-content-between border-b px-2 py-2.5">
          <div className="flex w-full flex-row">
            <Text
              color="greyscaleDark"
              className="self-center font-medium"
              size="normal"
            >
              Messaging Service SID
            </Text>
          </div>
          <div className="flex w-full">
            <Controller
              name="messagingServiceSID"
              control={control}
              rules={{
                required: true,
                pattern: {
                  value: /^[+a-zA-Z0-9-_/.]+$/,
                  message:
                    'The Messaging Service SID must either be a valid phone number or contain only letters, hyphens, and numbers.',
                },
              }}
              render={({ field }) => (
                <Input
                  {...field}
                  id="messagingServiceSID"
                  required
                  placeholder="Messaging Service SID"
                  value={field.value || ''}
                  onChange={(value: string) => {
                    if (value && !/^[+a-zA-Z0-9-_/.]+$/gi.test(value)) {
                      return;
                    }
                    field.onChange(value);
                  }}
                />
              )}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <Button
          variant="primary"
          type="submit"
          className="text-grayscaleDark mt-2 border text-sm+ font-normal"
          loading={isSubmitting}
          disabled={isSubmitting || isNotCompleted}
        >
          {isAlreadyEnabled ? 'Update SMS Settings' : 'Enable SMS'}
        </Button>
      </div>
    </form>
  );
}

export function EditSMSSettingsModal({
  close,
  isAlreadyEnabled,
}: {
  close: () => void;
  isAlreadyEnabled: boolean;
}) {
  return (
    <div className="w-modal px-6 py-4 text-left">
      <div className="flex flex-col">
        <div className="mx-auto mt-2.5">
          <TwilioIcon className=" text-greyscaleDark" />
        </div>
        <Text
          variant="subHeading"
          color="greyscaleDark"
          size="large"
          className="mt-3 text-center"
        >
          Set up Twilio SMS Service
        </Text>
        <Text
          variant="body"
          color="greyscaleDark"
          size="small"
          className="mt-0.5 mb-6 text-center font-normal"
        >
          SMS messages are sent through Twilio. Create an account and a
          messaging service at https://console.twilio.com.
        </Text>
        <div>
          <ErrorBoundary fallbackRender={ErrorBoundaryFallback}>
            <EditSMSSettingsForm
              close={close}
              isAlreadyEnabled={isAlreadyEnabled}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export interface EditSMSSettingsProps {
  close: () => void;
}

export interface EditSMSSettingsFormData {
  accountSID: string;
  authToken: string;
  messagingServiceSID: string;
}

export function EditSMSSettings({ close }: EditSMSSettingsProps) {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const form = useForm<EditSMSSettingsFormData>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      accountSID: '',
      authToken: '',
      messagingServiceSID: '',
    },
  });

  const { data, loading, error } = useGetSmsSettingsQuery({
    variables: {
      id: currentApplication.id,
    },
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    form.setValue('accountSID', data.app.authSmsTwilioAccountSid);
    form.setValue('authToken', data.app.authSmsTwilioAuthToken);
    form.setValue(
      'messagingServiceSID',
      data.app.authSmsTwilioMessagingServiceId,
    );
  }, [data, form]);

  if (loading) {
    return <DelayedLoading delay={500} />;
  }

  if (error) {
    throw error;
  }

  return (
    <FormProvider {...form}>
      <EditSMSSettingsModal
        close={close}
        isAlreadyEnabled={data.app.authSmsPasswordlessEnabled}
      />
    </FormProvider>
  );
}
