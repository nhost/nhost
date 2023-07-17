import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Input } from '@/components/ui/v2/Input';
import type { CreateServiceFormValues } from '@/features/services/components/CreateServiceForm';
import { FormProvider, useForm } from 'react-hook-form';

interface ServiceNameFormSectionProps
  extends Pick<CreateServiceFormValues, 'name'> {}
interface ServiceNameFormValues extends Pick<CreateServiceFormValues, 'name'> {}

export default function ServiceNameFormSection({
  name,
}: ServiceNameFormSectionProps) {
  const form = useForm<ServiceNameFormValues>({
    defaultValues: { name },
  });

  const { formState, register } = form;

  const handleServiceNameChange = async (values: ServiceNameFormValues) => {
    console.log({ values });
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleServiceNameChange}>
        <SettingsContainer
          title="Service Name"
          description="The name of the service."
          className="grid grid-flow-row px-4 lg:grid-cols-4"
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty,
              loading: formState.isSubmitting,
            },
          }}
        >
          <Input
            {...register('name')}
            className="col-span-2"
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
