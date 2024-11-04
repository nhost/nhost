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
import * as Yup from 'yup';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

const validationSchema = Yup.object({
  allowedUrls: Yup.string().label('Allowed Redirect URLs'),
});

export type AllowedRedirectURLFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function AllowedRedirectURLsSettings() {
  const { project } = useProject();
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { allowedUrls } = data?.config?.auth?.redirections || {};

  const form = useForm<AllowedRedirectURLFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      allowedUrls: allowedUrls?.join(', ') || '',
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading && allowedUrls) {
      form.reset({
        allowedUrls: allowedUrls?.join(', ') || '',
      });
    }
  }, [loading, allowedUrls, form]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading allowed redirect URL settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { register, formState } = form;

  const handleAllowedRedirectURLsChange = async (
    values: AllowedRedirectURLFormValues,
  ) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project.id,
        config: {
          auth: {
            redirections: {
              allowedUrls: values.allowedUrls
                ? values.allowedUrls.split(',').map((url) => url.trim())
                : [],
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
        loadingMessage: 'Allowed redirect URL settings are being updated...',
        successMessage:
          'Allowed redirect URL settings have been updated successfully.',
        errorMessage:
          "An error occurred while trying to update the project's allowed redirect URL settings.",
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleAllowedRedirectURLsChange}>
        <SettingsContainer
          title="Allowed Redirect URLs"
          description="Allowed URLs where users can be redirected to after authentication. Separate multiple redirect URLs with comma."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://docs.nhost.io/guides/auth/overview#allowed-redirect-urls"
          className="grid grid-flow-row px-4 lg:grid-cols-5"
        >
          <Input
            {...register('allowedUrls')}
            name="allowedUrls"
            id="allowedUrls"
            placeholder="http://localhost:3000, http://localhost:4000"
            className="col-span-2"
            fullWidth
            hideEmptyHelperText
            aria-label="Allowed Redirect URLs"
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
