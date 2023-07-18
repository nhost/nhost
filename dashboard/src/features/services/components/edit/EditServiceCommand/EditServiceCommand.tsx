import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import type { CreateServiceFormValues } from '@/features/services/components/CreateServiceForm';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useUpdateRunServiceConfigMutation } from '@/utils/__generated__/graphql';
import type { ApolloError } from '@apollo/client';
import { useRouter } from 'next/router';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

interface EditServiceCommandFormValues
  extends Required<Pick<CreateServiceFormValues, 'command'>> {}
interface EditServiceCommandProps extends EditServiceCommandFormValues {}

export default function EditServiceCommand({
  command,
}: EditServiceCommandProps) {
  const {
    query: { serviceId },
  } = useRouter();

  const { currentProject } = useCurrentWorkspaceAndProject();

  const form = useForm<EditServiceCommandFormValues>({
    defaultValues: {
      command,
    },
  });

  const { reset, control, register, formState } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'command',
  });

  const [updateRunServiceConfig] = useUpdateRunServiceConfigMutation();

  const handleCommandChanged = async (values: EditServiceCommandFormValues) => {
    try {
      await toast.promise(
        updateRunServiceConfig({
          variables: {
            appID: currentProject.id,
            serviceID: serviceId,
            config: {
              command: values.command.map((item) => item.command),
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
      // Note: error is handled by the toast
    }
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleCommandChanged}>
        <SettingsContainer
          title="Command"
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty,
              loading: formState.isSubmitting,
            },
          }}
        >
          <Box className="grid w-full place-content-end">
            <Button
              variant="borderless"
              onClick={() => append({ command: '' })}
            >
              <PlusIcon className="h-5 w-5" />
            </Button>
          </Box>
          <Box className="flex flex-col space-y-4">
            {fields.map((field, index) => (
              <Box key={field.id} className="flex w-full flex-row space-x-2">
                <Input
                  {...register(`command.${index}.command`)}
                  id={`${field.id}`}
                  className="w-full"
                  hideEmptyHelperText
                  error={!!formState.errors?.command?.at(index)}
                  helperText={formState?.errors.command?.at(index)?.message}
                  fullWidth
                  autoComplete="off"
                />
                <Button
                  variant="borderless"
                  className=""
                  color="error"
                  onClick={() => remove(index)}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </Box>
            ))}
          </Box>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
