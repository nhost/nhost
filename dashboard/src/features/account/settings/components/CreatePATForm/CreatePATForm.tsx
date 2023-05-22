import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/common/Form';
import type { DialogFormProps } from '@/types/common';
import { Box } from '@/ui/v2/Box';
import { Button } from '@/ui/v2/Button';
import { Input } from '@/ui/v2/Input';
import { Text } from '@/ui/v2/Text';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

export const createPATFormValidationSchema = Yup.object({
  name: Yup.string().label('Name').nullable().required(),
  expiresAt: Yup.string().label('Expires at').nullable().required(),
});

export type CreatePATFormValues = Yup.InferType<
  typeof createPATFormValidationSchema
>;

export interface CreatePATFormProps extends DialogFormProps {
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
}

export default function CreatePATForm({
  onCancel,
  location,
}: CreatePATFormProps) {
  const { onDirtyStateChange } = useDialog();
  const form = useForm<CreatePATFormValues>({
    reValidateMode: 'onSubmit',
    resolver: yupResolver(createPATFormValidationSchema),
  });

  const { register, formState } = form;

  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  function handleSubmit(formValues: CreatePATFormValues) {
    console.log(formValues);
  }

  return (
    <Box className="grid grid-flow-row gap-4 px-6 pb-6">
      <Text variant="subtitle1">
        Personal access tokens are used to authenticate with Nhost services.
      </Text>
      <FormProvider {...form}>
        <Form onSubmit={handleSubmit} className="grid grid-flow-row gap-4">
          <Input
            {...register('name')}
            id="name"
            label="Name"
            fullWidth
            helperText={formState.errors.name?.message}
            error={Boolean(formState.errors.name)}
          />

          <Input
            {...register('expiresAt')}
            type="date"
            id="expires-at"
            label="Expires at"
            fullWidth
            inputProps={{ min: new Date().toISOString().split('T')[0] }}
            helperText={formState.errors.expiresAt?.message}
            error={Boolean(formState.errors.expiresAt)}
          />

          <Box className="grid grid-flow-row gap-2">
            <Button type="submit" loading={formState.isSubmitting}>
              Create
            </Button>

            <Button variant="outlined" color="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </Box>
        </Form>
      </FormProvider>
    </Box>
  );
}
