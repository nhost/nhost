import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import { useGetAppQuery, useUpdateAppMutation } from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Input from '@/ui/v2/Input';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';

export interface BlockedEmailFormValues {
  /**
   * Determines whether or not the blocked email settings are enabled.
   */
  enabled: boolean;
  /**
   * Set of emails that are blocked from registering to the user's project.
   */
  authAccessControlBlockedEmails: string;
  /**
   * Set of email domains that are blocked from registering to the user's project.
   */
  authAccessControlBlockedEmailDomains: string;
}

export default function BlockedEmailSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation();

  const { data, loading, error } = useGetAppQuery({
    variables: {
      id: currentApplication?.id,
    },
  });

  const form = useForm<BlockedEmailFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled:
        Boolean(data?.app?.authAccessControlBlockedEmails) ||
        Boolean(data?.app?.authAccessControlBlockedEmailDomains),
      authAccessControlBlockedEmails: data?.app?.authAccessControlBlockedEmails,
      authAccessControlBlockedEmailDomains:
        data?.app?.authAccessControlBlockedEmailDomains,
    },
  });

  const { register, formState, setValue, watch } = form;
  const enabled = watch('enabled');
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  useEffect(() => {
    if (
      !data.app?.authAccessControlBlockedEmails &&
      !data.app?.authAccessControlBlockedEmailDomains
    ) {
      return;
    }

    setValue('enabled', true, { shouldDirty: false });
  }, [data.app, setValue]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading blocked emails and domains..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const handleAllowedEmailDomainsChange = async (
    values: BlockedEmailFormValues,
  ) => {
    const updateAppMutation = updateApp({
      variables: {
        id: currentApplication.id,
        app: {
          authAccessControlBlockedEmails: values.enabled
            ? values.authAccessControlBlockedEmails
            : '',
          authAccessControlBlockedEmailDomains: values.enabled
            ? values.authAccessControlBlockedEmailDomains
            : '',
        },
      },
    });

    await toast.promise(
      updateAppMutation,
      {
        loading: `Blocked email and domain settings are being updated...`,
        success: `Blocked email and domain settings have been updated successfully.`,
        error: `An error occurred while trying to update the project's blocked email and domain settings.`,
      },
      getToastStyleProps(),
    );

    form.reset(values);
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleAllowedEmailDomainsChange}>
        <SettingsContainer
          title="Blocked Emails and Domains"
          description="Block specific email addresses and domains to sign up."
          slotProps={{
            submitButton: {
              disabled: !formState.isValid || !isDirty,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://docs.nhost.io/authentication#blocked-emails-and-domains"
          enabled={enabled}
          onEnabledChange={(switchEnabled) =>
            setValue('enabled', switchEnabled, { shouldDirty: true })
          }
          showSwitch
          className={twMerge(
            'row-span-2 grid grid-flow-row gap-4 px-4 lg:grid-cols-3',
            !enabled && 'hidden',
          )}
        >
          <Input
            {...register('authAccessControlBlockedEmails')}
            name="authAccessControlBlockedEmails"
            id="authAccessControlBlockedEmails"
            placeholder="These emails (separated by comma, e.g, david@ikea.com, lisa@mycompany.com)"
            className="col-span-2"
            label="Blocked Emails (comma separated)"
            fullWidth
            hideEmptyHelperText
          />
          <Input
            {...register('authAccessControlBlockedEmailDomains')}
            name="authAccessControlBlockedEmailDomains"
            id="authAccessControlBlockedEmailDomains"
            label="Blocked Email Domains (comma sepated list)"
            placeholder="These email domains (separated by comma, e.g, ikea.com, mycompany.com)"
            className="col-span-2"
            fullWidth
            hideEmptyHelperText
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
