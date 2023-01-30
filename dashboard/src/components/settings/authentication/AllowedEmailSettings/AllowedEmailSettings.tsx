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

export interface AllowedEmailSettingsFormValues {
  /**
   * Determines whether or not the allowed email settings are enabled.
   */
  enabled: boolean;
  /**
   * Set of email that are allowed to be used for project's users authentication.
   */
  authAccessControlAllowedEmails: string;
  /**
   * Set of email domains that are allowed to be used for project's users authentication.
   * @example 'nhost.io'
   */
  authAccessControlAllowedEmailDomains: string;
}

export default function AllowedEmailDomainsSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation();

  const { data, loading, error } = useGetAppQuery({
    variables: {
      id: currentApplication?.id,
    },
  });

  const form = useForm<AllowedEmailSettingsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled:
        Boolean(data?.app?.authAccessControlAllowedEmails) ||
        Boolean(data?.app?.authAccessControlAllowedEmailDomains),
      authAccessControlAllowedEmails: data?.app?.authAccessControlAllowedEmails,
      authAccessControlAllowedEmailDomains:
        data?.app?.authAccessControlAllowedEmailDomains,
    },
  });

  const { register, formState, setValue, watch } = form;
  const enabled = watch('enabled');
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  useEffect(() => {
    if (
      !data.app?.authAccessControlAllowedEmails &&
      !data.app?.authAccessControlAllowedEmailDomains
    ) {
      return;
    }

    setValue('enabled', true, { shouldDirty: false });
  }, [data.app, setValue]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Allowed Email Settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const handleAllowedEmailDomainsChange = async (
    values: AllowedEmailSettingsFormValues,
  ) => {
    const updateAppMutation = updateApp({
      variables: {
        id: currentApplication.id,
        app: {
          authAccessControlAllowedEmails: values.enabled
            ? values.authAccessControlAllowedEmails
            : '',
          authAccessControlAllowedEmailDomains: values.enabled
            ? values.authAccessControlAllowedEmailDomains
            : '',
        },
      },
    });

    await toast.promise(
      updateAppMutation,
      {
        loading: `Allowed email settings are being updated...`,
        success: `Allowed email settings have been updated successfully.`,
        error: `An error occurred while trying to update the project's allowed email settings.`,
      },
      getToastStyleProps(),
    );

    form.reset(values);
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleAllowedEmailDomainsChange}>
        <SettingsContainer
          title="Allowed Emails and Domains"
          description="Allow specific email addresses and domains to sign up."
          slotProps={{
            submitButton: {
              disabled: !formState.isValid || !isDirty,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://docs.nhost.io/authentication#allowed-emails-and-domains"
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
            {...register('authAccessControlAllowedEmails')}
            name="authAccessControlAllowedEmails"
            id="authAccessControlAllowedEmails"
            placeholder="These emails (separated by comma, e.g, david@ikea.com, lisa@mycompany.com)"
            className="col-span-2"
            label="Allowed Emails (comma separated)"
            fullWidth
            hideEmptyHelperText
          />
          <Input
            {...register('authAccessControlAllowedEmailDomains')}
            name="authAccessControlAllowedEmailDomains"
            id="authAccessControlAllowedEmailDomains"
            label="Allowed Email Domains (comma sepated list)"
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
