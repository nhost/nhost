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
  clientUrl: Yup.string().label('Client URL'),
});

export type ClientURLFormValues = Yup.InferType<typeof validationSchema>;

export default function ClientURLSettings() {
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

  const { clientUrl, allowedUrls } = data?.config?.auth?.redirections || {};

  const form = useForm<ClientURLFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      clientUrl,
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading && clientUrl) {
      form.reset({ clientUrl });
    }
  }, [loading, clientUrl, form]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading client URL settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { register, formState } = form;

  const handleClientURLChange = async (values: ClientURLFormValues) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project.id,
        config: {
          auth: {
            redirections: {
              ...values,
              allowedUrls,
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
        loadingMessage: 'Client URL is being updated...',
        successMessage: 'Client URL has been updated successfully.',
        errorMessage:
          "An error occurred while trying to update the project's Client URL.",
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleClientURLChange}>
        <SettingsContainer
          title="Client URL"
          description="This should be the URL of your frontend app where users are redirected after authenticating."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://docs.nhost.io/guides/auth/overview#client-url"
          className="grid grid-flow-row lg:grid-cols-5"
        >
          <Input
            {...register('clientUrl')}
            name="clientUrl"
            id="clientUrl"
            placeholder="http://localhost:3000"
            className="col-span-2"
            fullWidth
            hideEmptyHelperText
            aria-label="Client URL"
            error={!!formState.errors?.clientUrl}
            helperText={formState.errors?.clientUrl?.message}
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
