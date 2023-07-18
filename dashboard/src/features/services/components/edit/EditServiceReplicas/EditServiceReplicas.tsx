import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Slider } from '@/components/ui/v2/Slider';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { MAX_SERVICE_REPLICAS } from '@/features/projects/resources/settings/utils/resourceSettingsValidationSchema';
import type { CreateServiceFormValues } from '@/features/services/components/CreateServiceForm';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useUpdateRunServiceConfigMutation } from '@/utils/__generated__/graphql';
import type { ApolloError } from '@apollo/client';
import { useRouter } from 'next/router';
import { FormProvider, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

interface EditServiceReplicasFormValues
  extends Pick<CreateServiceFormValues, 'replicas'> {}
interface EditServiceReplicasProps extends EditServiceReplicasFormValues {}

export default function EditServiceReplicas({
  replicas,
}: EditServiceReplicasProps) {
  const {
    query: { serviceId },
  } = useRouter();

  const { currentProject } = useCurrentWorkspaceAndProject();

  const form = useForm<EditServiceReplicasFormValues>({
    defaultValues: {
      replicas,
    },
  });

  const { reset, setValue, watch, formState } = form;

  const replicasFormValue = watch('replicas');

  const handleReplicasChange = (value: string) => {
    const updatedReplicas = parseInt(value, 10);
    setValue('replicas', updatedReplicas, { shouldDirty: true });
  };

  const [updateRunServiceConfig] = useUpdateRunServiceConfigMutation();

  const handleEditReplicas = async (values: EditServiceReplicasFormValues) => {
    try {
      await toast.promise(
        updateRunServiceConfig({
          variables: {
            appID: currentProject.id,
            serviceID: serviceId,
            config: {
              resources: {
                replicas: values.replicas,
              },
            },
          },
        }),
        {
          loading: 'Updating...',
          success: () => {
            // Reset the form state to disable the save button
            reset({}, { keepValues: true });
            return 'The service has been updated successfully.';
          },
          error: (arg: ApolloError) => {
            // we need to get the internal error message from the GraphQL error
            const { internal } = arg.graphQLErrors[0]?.extensions || {};
            const { message } = (internal as Record<string, any>)?.error || {};

            // Reset the form to the previous value when there is an error
            reset({ replicas });

            // we use the default Apollo error message if we can't find the
            // internal error message
            return (
              message ||
              arg.message ||
              'An error occurred while updating the service. Please try again.'
            );
          },
        },
        getToastStyleProps(),
      );
    } catch {
      // Toast will handle the error
    }
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleEditReplicas}>
        <SettingsContainer
          title={`Replicas (${replicasFormValue})`}
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty,
              loading: formState.isSubmitting,
            },
          }}
        >
          <Slider
            value={replicasFormValue}
            onChange={(_event, value) => handleReplicasChange(value.toString())}
            min={0}
            max={MAX_SERVICE_REPLICAS}
            step={1}
            aria-label="Replicas"
            marks
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
