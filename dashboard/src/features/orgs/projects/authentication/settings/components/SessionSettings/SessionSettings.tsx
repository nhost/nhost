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
  accessTokenExpiresIn: Yup.number()
    .label('Access token expiration')
    .typeError('Access token expiration must be a number')
    .required(),
  refreshTokenExpiresIn: Yup.number()
    .label('Refresh token expiration')
    .typeError('Refresh token expiration must be a number')
    .required(),
});

export type SessionFormValues = Yup.InferType<typeof validationSchema>;

export default function SessionSettings() {
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

  const { accessToken, refreshToken } = data?.config?.auth?.session || {};

  const form = useForm<SessionFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      accessTokenExpiresIn: accessToken?.expiresIn || 900,
      refreshTokenExpiresIn: refreshToken?.expiresIn || 43200,
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading && accessToken && refreshToken) {
      form.reset({
        accessTokenExpiresIn: accessToken?.expiresIn || 900,
        refreshTokenExpiresIn: refreshToken?.expiresIn || 43200,
      });
    }
  }, [loading, accessToken, refreshToken, form]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading session settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { register, formState } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  const handleSessionSettingsChange = async (formValues: SessionFormValues) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project.id,
        config: {
          auth: {
            session: {
              accessToken: { expiresIn: formValues.accessTokenExpiresIn },
              refreshToken: { expiresIn: formValues.refreshTokenExpiresIn },
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(formValues);

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
        loadingMessage: 'Session settings are being updated...',
        successMessage: 'Session settings have been updated successfully.',
        errorMessage:
          "An error occurred while trying to update the project's session settings.",
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSessionSettingsChange}>
        <SettingsContainer
          title="Session"
          description="Change the expiration time of the access and refresh tokens."
          slotProps={{
            submitButton: {
              disabled: !isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          className="grid grid-cols-5 grid-rows-2 gap-y-6"
        >
          <Input
            {...register('accessTokenExpiresIn')}
            id="accessTokenExpiresIn"
            type="number"
            label="Access Token Expires In (Seconds)"
            fullWidth
            className="col-span-5 lg:col-span-2"
            error={Boolean(formState.errors.accessTokenExpiresIn?.message)}
            helperText={formState.errors.accessTokenExpiresIn?.message}
          />

          <Input
            {...register('refreshTokenExpiresIn')}
            id="refreshTokenExpiresIn"
            type="number"
            label="Refresh Token Expires In (Seconds)"
            fullWidth
            className="col-span-5 row-start-2 lg:col-span-2"
            error={Boolean(formState.errors.refreshTokenExpiresIn?.message)}
            helperText={formState.errors.refreshTokenExpiresIn?.message}
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
