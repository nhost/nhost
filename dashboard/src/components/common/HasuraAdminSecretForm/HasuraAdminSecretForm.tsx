import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import type { DialogFormProps } from '@/types/common';
import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

export const hasuraAdminSecretFormValidationSchema = Yup.object({
  x_hasura_admin_secret: Yup.string().label('Hasura Admin Secret').required(),
});

export type HasuraAdminSecretKeyFormValues = Yup.InferType<
  typeof hasuraAdminSecretFormValidationSchema
>;

export interface HasuraAdminSecretFormProps extends DialogFormProps {}

export default function HasuraAdminSecretForm({
  location,
}: HasuraAdminSecretFormProps) {
  const router = useRouter();
  const { onDirtyStateChange } = useDialog();

  const form = useForm<HasuraAdminSecretKeyFormValues>({
    reValidateMode: 'onSubmit',
    resolver: yupResolver(hasuraAdminSecretFormValidationSchema),
  });

  const { register, formState } = form;

  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  async function handleSubmit(formValues: HasuraAdminSecretKeyFormValues) {
    try {
      // TODO test if the key is valid by querying Hasura
      // Or do an async validation setup before the submit
      localStorage.setItem(
        'x-hasura-admin-secret',
        formValues.x_hasura_admin_secret,
      );

      router.reload();
    } catch {
      // Note: This error is handled by the toast.
    }
  }

  return (
    <Box className="grid grid-flow-row gap-4 px-6 pb-6">
      <Alert severity="info" className="grid grid-flow-row gap-2">
        <Box className="grid grid-flow-row bg-transparent">
          <Text color="secondary" className="text-sm">
            Since this is the first time, please enter your Hasura Admin Secret
          </Text>
        </Box>
      </Alert>

      <FormProvider {...form}>
        <Form onSubmit={handleSubmit} className="grid grid-flow-row gap-4">
          <Input
            {...register('x_hasura_admin_secret')}
            id="x_hasura_admin_secret"
            label="Hasura Admin Secret"
            autoFocus
            fullWidth
            helperText={formState.errors.x_hasura_admin_secret?.message}
            error={Boolean(formState.errors.x_hasura_admin_secret)}
          />

          <Box className="grid grid-flow-row gap-2">
            <Button type="submit" loading={formState.isSubmitting}>
              OK
            </Button>
          </Box>
        </Form>
      </FormProvider>
    </Box>
  );
}
