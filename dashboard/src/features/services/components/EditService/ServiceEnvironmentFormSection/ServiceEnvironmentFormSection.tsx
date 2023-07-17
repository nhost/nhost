import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import type { CreateServiceFormValues } from '@/features/services/components/CreateServiceForm';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';

interface ServiceEnvironmentFormValues
  extends Pick<CreateServiceFormValues, 'environment'> {}
interface ServiceEnvironmentFormSectionProps
  extends Pick<CreateServiceFormValues, 'environment'> {}

export default function ServiceEnvironmentFormSection({
  environment,
}: ServiceEnvironmentFormSectionProps) {
  const form = useForm<ServiceEnvironmentFormValues>({
    defaultValues: {
      environment,
    },
  });

  const { control, register, formState } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'environment',
  });

  // const handleEnvironmentChange = async (
  //   values: ServiceEnvironmentFormValues,
  // ) => {
  //   console.log({ values });
  // };

  return (
    <FormProvider {...form}>
      <Form
      // onSubmit={handleEnvironmentChange}
      >
        <SettingsContainer
          title="Environment"
          // className="grid grid-flow-row px-4 lg:grid-cols-4"
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
              onClick={() => append({ name: '', value: '' })}
            >
              <PlusIcon className="h-5 w-5" />
            </Button>
          </Box>
          <Box className="flex flex-col space-y-4">
            {fields.map((field, index) => (
              <Box key={field.id} className="flex w-full flex-row space-x-2">
                <Input
                  {...register(`environment.${index}.name`)}
                  id={`${field.id}-name`}
                  placeholder={`Key ${index}`}
                  className="w-full"
                  hideEmptyHelperText
                  error={!!formState.errors?.environment?.at(index)}
                  helperText={formState.errors?.environment?.at(index)?.message}
                  fullWidth
                  autoComplete="off"
                />
                <Input
                  {...register(`environment.${index}.value`)}
                  id={`${field.id}-value`}
                  placeholder={`Value ${index}`}
                  className="w-full"
                  hideEmptyHelperText
                  error={!!formState.errors?.environment?.at(index)}
                  helperText={formState.errors?.environment?.at(index)?.message}
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
