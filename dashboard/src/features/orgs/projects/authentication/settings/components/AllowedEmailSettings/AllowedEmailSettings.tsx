import { yupResolver } from '@hookform/resolvers/yup';
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
import { Switch } from '@/components/ui/v3/switch';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetAuthenticationSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';

const validationSchema = Yup.object({
  enabled: Yup.boolean().label('Enabled'),
  allowedEmails: Yup.string().label('Allowed Emails'),
  allowedEmailDomains: Yup.string().label('Allowed Email Domains'),
});

export type AllowedEmailSettingsFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function AllowedEmailDomainsSettings() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { openDialog } = useDialog();
  const localMimirClient = useLocalMimirClient();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { email, emailDomains } = data?.config?.auth?.user || {};

  const form = useForm<AllowedEmailSettingsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled:
        (email?.allowed?.length ?? 0) > 0 ||
        (emailDomains?.allowed?.length ?? 0) > 0,
      allowedEmails: email?.allowed?.join(', ') || '',
      allowedEmailDomains: emailDomains?.allowed?.join(', ') || '',
    },
    resolver: yupResolver(validationSchema),
  });

  const { formState, watch } = form;
  const enabled = watch('enabled');

  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  useEffect(() => {
    if (!loading && email && emailDomains) {
      form.reset({
        enabled:
          (email?.allowed?.length ?? 0) > 0 ||
          (emailDomains?.allowed?.length ?? 0) > 0,
        allowedEmails: email?.allowed?.join(', ') || '',
        allowedEmailDomains: emailDomains?.allowed?.join(', ') || '',
      });
    }
  }, [loading, form, email, emailDomains]);

  if (error) {
    throw error;
  }

  const handleAllowedEmailDomainsChange = async (
    values: AllowedEmailSettingsFormValues,
  ) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          auth: {
            user: {
              email: {
                blocked: email?.blocked,
                allowed:
                  values.enabled && values.allowedEmails
                    ? values.allowedEmails
                        .split(',')
                        .map((allowedEmail) => allowedEmail.trim())
                    : [],
              },
              emailDomains: {
                blocked: emailDomains?.blocked,
                allowed:
                  values.enabled && values.allowedEmailDomains
                    ? values.allowedEmailDomains
                        .split(',')
                        .map((allowedEmailDomain) => allowedEmailDomain.trim())
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
        loadingMessage: 'Allowed email settings are being updated...',
        successMessage:
          'Allowed email settings have been updated successfully.',
        errorMessage:
          "An error occurred while trying to update the project's allowed email settings.",
      },
    );

    form.reset(values);
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleAllowedEmailDomainsChange}>
        <SettingsCard>
          <SettingsCardHeader
            title="Allowed Emails and Domains"
            description="Allow specific email addresses and domains to sign up."
            control={
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Toggle Allowed Emails and Domains"
                  />
                )}
              />
            }
          />

          <SettingsCardContent
            className={twMerge(
              'row-span-2 grid grid-flow-row gap-4 px-4 lg:grid-cols-3',
              !enabled && 'hidden',
            )}
          >
            <FormInput
              control={form.control}
              name="allowedEmails"
              placeholder="These emails (separated by comma, e.g, david@ikea.com, lisa@mycompany.com)"
              containerClassName="col-span-2"
              label="Allowed Emails (comma separated)"
            />
            <FormInput
              control={form.control}
              name="allowedEmailDomains"
              label="Allowed Email Domains (comma sepated list)"
              placeholder="These email domains (separated by comma, e.g, ikea.com, mycompany.com)"
              containerClassName="col-span-2"
            />
          </SettingsCardContent>

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://docs.nhost.io/products/auth/restricting_emails_and_domains#allowed-emails-and-domains"
              title="Allowed Emails and Domains"
            />

            <ButtonWithLoading
              type="submit"
              disabled={!isDirty}
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
