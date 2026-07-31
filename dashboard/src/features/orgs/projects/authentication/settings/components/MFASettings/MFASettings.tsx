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
  issuer: Yup.string().label('OTP Issuer').required(),
});

export type MFASettingsFormValues = Yup.InferType<typeof validationSchema>;

export default function MFASettings() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { openDialog } = useDialog();
  const localMimirClient = useLocalMimirClient();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const enabled = !!data?.config?.auth?.totp?.enabled;
  const issuer = data?.config?.auth?.totp?.issuer || '';

  const form = useForm<MFASettingsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      issuer,
      enabled,
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading && issuer && enabled) {
      form.reset({
        issuer,
        enabled,
      });
    }
  }, [loading, issuer, enabled, form]);

  if (error) {
    throw error;
  }

  const { formState, watch } = form;
  const authMfaEnabled = watch('enabled');

  const handleMFASettingsChange = async (values: MFASettingsFormValues) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project!.id,
        config: {
          auth: {
            totp: values,
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
          'Multi-factor authentication settings are being updated...',
        successMessage:
          'Multi-factor authentication settings have been updated successfully.',
        errorMessage:
          "An error occurred while trying to update the project's multi-factor authentication settings.",
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleMFASettingsChange}>
        <SettingsCard>
          <SettingsCardHeader
            title="Multi-Factor Authentication"
            description="Enable users to use MFA to sign in"
            control={
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Toggle Multi-Factor Authentication"
                  />
                )}
              />
            }
          />

          <SettingsCardContent
            className={twMerge(
              'grid grid-flow-row lg:grid-cols-5',
              !authMfaEnabled && 'hidden',
            )}
          >
            <FormInput
              control={form.control}
              name="issuer"
              label="OTP Issuer"
              placeholder="Name of the One Time Password (OTP) issuer"
              containerClassName="col-span-2"
            />
          </SettingsCardContent>

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://docs.nhost.io/products/auth"
              title="Multi-Factor Authentication"
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
