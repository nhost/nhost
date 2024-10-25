import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import {
  GetSignInMethodsDocument,
  useGetSignInMethodsQuery,
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
  enabled: Yup.boolean(),
});

export type MagicLinkFormValues = Yup.InferType<typeof validationSchema>;

export default function MagicLinkSettings() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetSignInMethodsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetSignInMethodsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { enabled } = data?.config?.auth?.method?.emailPasswordless || {};

  const form = useForm<MagicLinkFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled,
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading) {
      form.reset({ enabled });
    }
  }, [loading, enabled, form]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading settings for Magic Link..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState } = form;

  const handleMagicLinkSettingsUpdate = async (values: MagicLinkFormValues) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project.id,
        config: {
          auth: {
            method: {
              emailPasswordless: values,
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
        loadingMessage: 'Magic Link settings are being updated...',
        successMessage: 'Magic Link settings have been updated successfully.',
        errorMessage:
          "An error occurred while trying to update the project's Magic Link settings.",
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleMagicLinkSettingsUpdate}>
        <SettingsContainer
          title="Magic Link"
          description="Allow users to sign in with a Magic Link."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://docs.nhost.io/guides/auth/sign-in-magic-link"
          docsTitle="how to sign in users with Magic Link"
          switchId="enabled"
          showSwitch
          className="hidden"
        />
      </Form>
    </FormProvider>
  );
}
