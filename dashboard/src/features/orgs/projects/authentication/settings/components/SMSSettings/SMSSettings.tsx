/** biome-ignore-all lint/suspicious/noThenProperty: yup thing */

import { yupResolver } from '@hookform/resolvers/yup';
import Image from 'next/image';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';
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
import { FormField } from '@/components/ui/v3/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { Switch } from '@/components/ui/v3/switch';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetSignInMethodsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';

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

  if (error) {
    throw error;
  }

  const { formState, watch } = form;
  const authSmsPasswordlessEnabled = watch('enabled');

  const handleSMSSettingsChange = async (values: SMSSettingsFormValues) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project!.id,
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
        <SettingsCard>
          <SettingsCardHeader
            title="Phone Number (SMS)"
            description="Allow users to sign in with Phone Number (SMS)."
            control={
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Toggle Phone Number (SMS)"
                  />
                )}
              />
            }
          />

          <SettingsCardContent
            className={twMerge(
              'grid grid-flow-col grid-cols-2 grid-rows-4 gap-x-3 gap-y-4 px-4 py-2',
              !authSmsPasswordlessEnabled && 'hidden',
            )}
          >
            <div className="col-span-2 grid gap-1 lg:col-span-1">
              <label htmlFor="provider" className="font-medium text-sm+">
                Provider
              </label>
              <Select disabled value="twilio">
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="twilio" textContent="Twilio">
                    <span className="grid grid-flow-col items-center gap-1 text-sm+">
                      <Image
                        src="/assets/brands/twilio.svg"
                        alt="Logo of Twilio"
                        width={20}
                        height={20}
                      />
                      <span>Twilio</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FormInput
              control={form.control}
              name="accountSid"
              label="Account SID"
              placeholder="Account SID"
              containerClassName="col-span-2 lg:col-span-1"
            />
            <FormInput
              control={form.control}
              name="authToken"
              label="Auth Token"
              placeholder="Auth Token"
              containerClassName="col-span-2 lg:col-span-1"
            />
            <FormInput
              control={form.control}
              name="messagingServiceId"
              label="Messaging Service ID"
              placeholder="Messaging Service ID"
              containerClassName="col-span-2 lg:col-span-1"
            />
          </SettingsCardContent>

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://docs.nhost.io/products/auth/otp/sms"
              title="how to sign in users with a phone number (SMS)"
            />

            <ButtonWithLoading
              type="submit"
              disabled={!formState.isDirty}
              loading={formState.isSubmitting}
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
