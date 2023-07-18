import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Input } from '@/components/ui/v2/Input';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import type { CreateServiceFormValues } from '@/features/services/components/CreateServiceForm';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useUpdateRunServiceConfigMutation } from '@/utils/__generated__/graphql';
import type { ApolloError } from '@apollo/client';
import { useRouter } from 'next/router';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

interface EditServiceNameProps
  extends Required<Pick<CreateServiceFormValues, 'name'>> {}
interface EditServiceNameFormValues
  extends Pick<CreateServiceFormValues, 'name'> {}

export default function ServiceNameFormSection({ name }: EditServiceNameProps) {
  const {
    query: { serviceId },
  } = useRouter();

  const { currentProject } = useCurrentWorkspaceAndProject();

  const form = useForm<EditServiceNameFormValues>({
    defaultValues: { name },
  });

  const [updateRunServiceConfig] = useUpdateRunServiceConfigMutation();

  const { formState, register, reset } = form;

  const handleServiceNameChange = async (values: EditServiceNameFormValues) => {
    try {
      await toast.promise(
        updateRunServiceConfig({
          variables: {
            appID: currentProject.id,
            serviceID: serviceId,
            config: {
              name: values.name,
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
    } catch {
      // Note the error is handled by the toast
    }
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleServiceNameChange} className="rounded-lg">
        <SettingsContainer
          title="Service Name"
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty,
              loading: formState.isSubmitting,
            },
          }}
        >
          <Input
            {...register('name')}
            className="flex"
            variant="inline"
            fullWidth
            hideEmptyHelperText
            helperText={formState.errors.name?.message}
            error={Boolean(formState.errors.name)}
            slotProps={{
              helperText: { className: 'col-start-1' },
            }}
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
