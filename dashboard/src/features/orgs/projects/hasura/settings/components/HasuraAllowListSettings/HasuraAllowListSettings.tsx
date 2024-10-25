import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';

import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  GetHasuraSettingsDocument,
  useGetHasuraSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';

import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  enabled: Yup.boolean(),
});

export type HasuraAllowListFormValues = Yup.InferType<typeof validationSchema>;

export default function HasuraAllowListSettings() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();

  const { project, refetch: refetchProject } = useProject();

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetHasuraSettingsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { enableAllowList } = data?.config?.hasura.settings || {};

  const form = useForm<HasuraAllowListFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled: enableAllowList,
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading) {
      form.reset({
        enabled: enableAllowList,
      });
    }
  }, [loading, enableAllowList, form]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading allow list settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  async function handleSubmit(formValues: HasuraAllowListFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project.id,
        config: {
          hasura: {
            settings: {
              enableAllowList: formValues.enabled,
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(formValues);
        await refetchProject();

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
        loadingMessage: 'Allow list settings are being updated...',
        successMessage: 'Allow list settings have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update allow list settings.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Allow List"
          description="Safely allow a limited number of GraphQL queries, mutations and subscriptions for your project."
          slotProps={{
            submitButton: {
              disabled: !form.formState.isDirty || maintenanceActive,
              loading: form.formState.isSubmitting,
            },
          }}
          switchId="enabled"
          docsTitle="enabling or disabling Allow Lists"
          docsLink="https://hasura.io/learn/graphql/hasura-advanced/security/3-allow-list/"
          showSwitch
          className="hidden"
        />
      </Form>
    </FormProvider>
  );
}
