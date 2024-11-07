import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Input } from '@/components/ui/v2/Input';
import {
  useGetAuthenticationSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

const validationSchema = Yup.object({
  enabled: Yup.boolean().label('Enabled'),
  blockedEmails: Yup.string().label('Blocked Emails'),
  blockedEmailDomains: Yup.string().label('Blocked Email Domains'),
});

export type BlockedEmailFormValues = Yup.InferType<typeof validationSchema>;

export default function BlockedEmailSettings() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { openDialog } = useDialog();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
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

  useEffect(() => {
    if (!loading && email && emailDomains) {
      form.reset({
        enabled:
          email?.blocked?.length > 0 || emailDomains?.blocked?.length > 0,
        blockedEmails: email?.blocked?.join(', ') || '',
        blockedEmailDomains: emailDomains?.blocked?.join(', ') || '',
      });
    }
  }, [loading, email, emailDomains, form]);

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
        appId: project.id,
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
        loadingMessage:
          'Blocked email and domain settings are being updated...',
        successMessage:
          'Blocked email and domain settings have been updated successfully.',
        errorMessage:
          "An error occurred while trying to update the project's blocked email and domain settings.",
      },
    );
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
          docsLink="https://docs.nhost.io/guides/auth/overview#allowed-emails-and-domains"
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
