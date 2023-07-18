import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Input } from '@/components/ui/v2/Input';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { InfoCard } from '@/features/projects/overview/components/InfoCard';
import type { CreateServiceFormValues } from '@/features/services/components/CreateServiceForm';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useUpdateRunServiceConfigMutation } from '@/utils/__generated__/graphql';
import type { ApolloError } from '@apollo/client';
import { useRouter } from 'next/router';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

interface EditServiceImageFormValues
  extends Required<Pick<CreateServiceFormValues, 'image'>> {}
interface EditServiceImageProps extends EditServiceImageFormValues {}

export default function EditServiceImage({ image }: EditServiceImageProps) {
  const {
    query: { serviceId },
  } = useRouter();

  const form = useForm<EditServiceImageFormValues>({
    defaultValues: { image },
  });

  const { currentProject } = useCurrentWorkspaceAndProject();

  const { reset, formState, register } = form;

  const [updateRunServiceConfig] = useUpdateRunServiceConfigMutation();

  const handleServiceNameChange = async (
    values: EditServiceImageFormValues,
  ) => {
    await toast.promise(
      updateRunServiceConfig({
        variables: {
          appID: currentProject.id,
          serviceID: serviceId,
          config: {
            image: {
              image: values.image,
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
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleServiceNameChange}>
        <SettingsContainer
          title="Service Image"
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty,
              loading: formState.isSubmitting,
            },
          }}
        >
          <Input
            {...register('image')}
            className="flex"
            variant="inline"
            fullWidth
            hideEmptyHelperText
            helperText={formState.errors.image?.message}
            error={Boolean(formState.errors.image)}
            slotProps={{
              helperText: { className: 'col-start-1' },
            }}
          />

          <InfoCard
            title="Private registry"
            value={`registry.${currentProject.region.awsName}.${currentProject.region.domain}/${serviceId}`}
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
