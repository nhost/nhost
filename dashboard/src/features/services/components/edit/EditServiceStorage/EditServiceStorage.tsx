import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import {
  MAX_STORAGE_CAPACITY,
  MIN_STORAGE_CAPACITY,
} from '@/features/projects/resources/settings/utils/resourceSettingsValidationSchema';
import type { CreateServiceFormValues } from '@/features/services/components/CreateServiceForm';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useUpdateRunServiceConfigMutation } from '@/utils/__generated__/graphql';
import type { ApolloError } from '@apollo/client';
import { useRouter } from 'next/router';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

interface EditServiceStorageFormValues
  extends Required<Pick<CreateServiceFormValues, 'storage'>> {}
interface EditServiceStorageProps extends EditServiceStorageFormValues {}

export default function EditServiceStorage({
  storage,
}: EditServiceStorageProps) {
  const {
    query: { serviceId },
  } = useRouter();

  const { currentProject } = useCurrentWorkspaceAndProject();

  const form = useForm<EditServiceStorageFormValues>({
    defaultValues: {
      storage,
    },
  });

  const [updateRunServiceConfig] = useUpdateRunServiceConfigMutation();

  const { reset, control, register, setValue, formState } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'storage',
  });

  const checkBounds = (value: string, index: number) => {
    const storageCapacity = parseInt(value, 10);

    if (Number.isNaN(storageCapacity)) {
      setValue(`storage.${index}.capacity`, 1);
    }

    if (storageCapacity > MAX_STORAGE_CAPACITY) {
      setValue(`storage.${index}.capacity`, MAX_STORAGE_CAPACITY);
    }

    if (storageCapacity < MIN_STORAGE_CAPACITY) {
      setValue(`storage.${index}.capacity`, MIN_STORAGE_CAPACITY);
    }
  };

  const handleStorageChanged = async (values: EditServiceStorageFormValues) => {
    try {
      await toast.promise(
        updateRunServiceConfig({
          variables: {
            appID: currentProject.id,
            serviceID: serviceId,
            config: {
              resources: {
                storage: values.storage.map((item) => ({
                  name: item.name,
                  path: item.path,
                  capacity: Number(item.capacity),
                })),
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
    } catch {
      // Note the error is handled by the toast
    }
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleStorageChanged}>
        <SettingsContainer
          title="Storage"
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty,
              loading: formState.isSubmitting,
            },
          }}
        >
          <Box className="grid place-content-end">
            <Button
              variant="borderless"
              onClick={() => append({ name: '', capacity: 1, path: '' })}
            >
              <PlusIcon className="h-5 w-5" />
            </Button>
          </Box>

          <Box className="flex flex-col space-y-4">
            {fields.map((field, index) => (
              <Box key={field.id} className="flex w-full flex-row space-x-2">
                <Input
                  {...register(`storage.${index}.name`)}
                  id={`${field.id}-name`}
                  placeholder="Name"
                  className="w-full"
                  hideEmptyHelperText
                  error={!!formState.errors?.storage?.at(index)}
                  helperText={formState.errors?.storage?.at(index)?.message}
                  fullWidth
                  autoComplete="off"
                />

                <Input
                  {...register(`storage.${index}.capacity`, {
                    onBlur: (event) => checkBounds(event.target.value, index),
                  })}
                  id={`${field.id}-capacity`}
                  type="number"
                  placeholder="Capacity"
                  className="w-full"
                  hideEmptyHelperText
                  error={!!formState.errors?.storage?.at(index)}
                  helperText={formState.errors?.storage?.at(index)?.message}
                  fullWidth
                  autoComplete="off"
                  endAdornment={
                    <Text sx={{ color: 'grey.500' }} className="pr-2">
                      GiB
                    </Text>
                  }
                />

                <Input
                  {...register(`storage.${index}.path`)}
                  id={`${field.id}-path`}
                  placeholder="Path"
                  className="w-full"
                  hideEmptyHelperText
                  error={!!formState.errors?.storage?.at(index)}
                  helperText={formState.errors?.storage?.at(index)?.message}
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
