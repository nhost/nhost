import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Input } from '@/components/ui/v2/Input';
import { FormProvider, useForm } from 'react-hook-form';

interface ServiceImageSectionProps {
  image: string;
}

interface ServiceImageValues {
  image: string;
}

export default function ServiceImageSection({
  image,
}: ServiceImageSectionProps) {
  const form = useForm<ServiceImageValues>({
    defaultValues: { image },
  });

  const { formState, register } = form;

  // const handleServiceNameChange = async (values: ServiceImageValues) => {
  //   console.log({ values });
  // };

  return (
    <FormProvider {...form}>
      <Form
      // onSubmit={handleServiceNameChange}
      >
        <SettingsContainer
          title="Service Image"
          description="The image of the service."
          className="grid grid-flow-row px-4 lg:grid-cols-4"
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty,
              loading: formState.isSubmitting,
            },
          }}
        >
          <Input
            {...register('image')}
            className="col-span-2"
            variant="inline"
            fullWidth
            hideEmptyHelperText
            helperText={formState.errors.image?.message}
            error={Boolean(formState.errors.image)}
            slotProps={{
              helperText: { className: 'col-start-1' },
            }}
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
