import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Input } from '@/components/ui/v2/Input';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import {
  GetHasuraSettingsDocument,
  useGetHasuraSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { getToastStyleProps } from '@/utils/constants/settings';
import { getServerError } from '@/utils/getServerError';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
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
  const { maintenanceActive } = useUI();
  const { currentProject, refetch: refetchWorkspaceAndProject } =
    useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetHasuraSettingsDocument],
  });

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-first',
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

    try {
      await toast.promise(
        updateConfigPromise,
        {
          loading: `Pool size is being updated...`,
          success: `Pool size has been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update the pool size.`,
          ),
        },
        getToastStyleProps(),
      );

      form.reset(formValues);
      await refetchWorkspaceAndProject();
    } catch {
      // Note: The toast will handle the error.
    }
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
          className="grid grid-flow-row gap-y-2 gap-x-4 px-4 lg:grid-cols-5"
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
