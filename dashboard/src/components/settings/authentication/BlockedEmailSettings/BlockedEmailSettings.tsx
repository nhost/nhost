import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import { useUI } from '@/context/UIContext';
import {
  GetAuthenticationSettingsDocument,
  useGetAuthenticationSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Input from '@/ui/v2/Input';
import getServerError from '@/utils/settings/getServerError';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  enabled: Yup.boolean().label('Enabled'),
  blockedEmails: Yup.string().label('Blocked Emails'),
  blockedEmailDomains: Yup.string().label('Blocked Email Domains'),
});

export type BlockedEmailFormValues = Yup.InferType<typeof validationSchema>;

export default function BlockedEmailSettings() {
  const { maintenanceActive } = useUI();
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetAuthenticationSettingsDocument],
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: currentApplication?.id },
    fetchPolicy: 'cache-only',
  });

  const { email, emailDomains } = data?.config?.auth?.user || {};

  const form = useForm<BlockedEmailFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled: email?.blocked?.length > 0 || emailDomains?.blocked?.length > 0,
      blockedEmails: email?.blocked?.join(', ') || '',
      blockedEmailDomains: emailDomains?.blocked?.join(', ') || '',
    },
    resolver: yupResolver(validationSchema),
  });

  const { register, formState, watch } = form;
  const enabled = watch('enabled');
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

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
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentApplication.id,
        config: {
          auth: {
            user: {
              email: {
                allowed: email.allowed,
                blocked:
                  values.enabled && values.blockedEmails
                    ? [
                        ...new Set(
                          values.blockedEmails
                            .split(',')
                            .map((blockedEmail) => blockedEmail.trim()),
                        ),
                      ]
                    : [],
              },
              emailDomains: {
                allowed: emailDomains.allowed,
                blocked:
                  values.enabled && values.blockedEmailDomains
                    ? [
                        ...new Set(
                          values.blockedEmailDomains
                            .split(',')
                            .map((blockedEmailDomain) =>
                              blockedEmailDomain.trim(),
                            ),
                        ),
                      ]
                    : [],
              },
            },
          },
        },
      },
    });

    try {
      await toast.promise(
        updateConfigPromise,
        {
          loading: `Blocked email and domain settings are being updated...`,
          success: `Blocked email and domain settings have been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update the project's blocked email and domain settings.`,
          ),
        },
        getToastStyleProps(),
      );

      form.reset(values);
    } catch {
      // Note: The toast will handle the error.
    }
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleAllowedEmailDomainsChange}>
        <SettingsContainer
          title="Blocked Emails and Domains"
          description="Block specific email addresses and domains to sign up."
          slotProps={{
            submitButton: {
              disabled: !isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://docs.nhost.io/authentication#blocked-emails-and-domains"
          switchId="enabled"
          showSwitch
          className={twMerge(
            'row-span-2 grid grid-flow-row gap-4 px-4 lg:grid-cols-3',
            !enabled && 'hidden',
          )}
        >
          <Input
            {...register('blockedEmails')}
            name="blockedEmails"
            id="blockedEmails"
            placeholder="These emails (separated by comma, e.g, david@ikea.com, lisa@mycompany.com)"
            className="col-span-2"
            label="Blocked Emails (comma separated)"
            fullWidth
            hideEmptyHelperText
          />
          <Input
            {...register('blockedEmailDomains')}
            name="blockedEmailDomains"
            id="blockedEmailDomains"
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
