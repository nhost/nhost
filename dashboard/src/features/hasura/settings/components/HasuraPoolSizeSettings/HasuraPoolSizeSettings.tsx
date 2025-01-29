import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Input } from '@/components/ui/v2/Input';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import {
  GetHasuraSettingsDocument,
  useGetHasuraSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  httpPoolSize: Yup.number()
    .label('HTTP Pool Size')
    .min(1)
    .max(100)
    .typeError('HTTP Pool Size must be a number')
    .required(),
});

export type HasuraPoolSizeFormValues = Yup.InferType<typeof validationSchema>;

export default function HasuraPoolSizeSettings() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { currentProject, refetch: refetchWorkspaceAndProject } =
    useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetHasuraSettingsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: { appId: currentProject?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { httpPoolSize } = data?.config?.hasura.events || {};

  const form = useForm<HasuraPoolSizeFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: { httpPoolSize: httpPoolSize || 100 },
    resolver: yupResolver(validationSchema),
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading pool size settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState, register } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  async function handleSubmit(formValues: HasuraPoolSizeFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          hasura: {
            events: {
              httpPoolSize: formValues.httpPoolSize,
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(formValues);
        await refetchWorkspaceAndProject();

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
        loadingMessage: 'Pool size is being updated...',
        successMessage: 'Pool size has been updated successfully.',
        errorMessage: 'An error occurred while trying to update the pool size.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="HTTP Pool Size"
          description="Set the maximum number of concurrent HTTP workers for event delivery."
          docsLink="https://hasura.io/docs/latest/deployment/graphql-engine-flags/reference/#events-http-pool-size"
          slotProps={{
            submitButton: {
              disabled: !isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          className="grid grid-flow-row gap-x-4 gap-y-2 px-4 lg:grid-cols-5"
        >
          <Input
            {...register('httpPoolSize')}
            id="httpPoolSize"
            name="httpPoolSize"
            type="number"
            label="HTTP Pool Size"
            fullWidth
            className="lg:col-span-2"
            error={Boolean(formState.errors.httpPoolSize?.message)}
            helperText={formState.errors.httpPoolSize?.message}
            slotProps={{ inputRoot: { min: 1, max: 100 } }}
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
