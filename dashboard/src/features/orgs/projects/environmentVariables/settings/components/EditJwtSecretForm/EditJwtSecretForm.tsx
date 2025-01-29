import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import type { DialogFormProps } from '@/types/common';
import {
  GetEnvironmentVariablesDocument,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

export interface EditJwtSecretFormProps extends DialogFormProps {
  /**
   * Initial JWT secret.
   */
  jwtSecret: string;
  /**
   * Determines whether the form is disabled.
   */
  disabled?: boolean;
  /**
   * Submit button text.
   *
   * @default 'Save'
   */
  submitButtonText?: string;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => void;
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
}

const validationSchema = Yup.object({
  jwtSecret: Yup.string()
    .nullable()
    .required('This field is required.')
    .test('isJson', 'This is not a valid JSON.', (value) => {
      try {
        JSON.parse(value);
        return true;
      } catch (error) {
        return false;
      }
    }),
});

export type EditJwtSecretFormValues = Yup.InferType<typeof validationSchema>;

export default function EditJwtSecretForm({
  disabled,
  jwtSecret,
  onSubmit,
  onCancel,
  submitButtonText = 'Save',
  location,
}: EditJwtSecretFormProps) {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetEnvironmentVariablesDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { onDirtyStateChange } = useDialog();
  const form = useForm<EditJwtSecretFormValues>({
    defaultValues: {
      jwtSecret,
    },
    resolver: yupResolver(validationSchema),
  });

  const {
    register,
    formState: { dirtyFields, isSubmitting, errors },
  } = form;
  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  async function handleSubmit(values: EditJwtSecretFormValues) {
    const parsedJwtSecret = JSON.parse(values.jwtSecret);
    const isArray = Array.isArray(parsedJwtSecret);

    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          hasura: {
            jwtSecrets: isArray ? parsedJwtSecret : [parsedJwtSecret],
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        onSubmit?.();
      },
      {
        loadingMessage: 'Updating JWT secret...',
        successMessage: 'JWT secret has been updated successfully.',
        errorMessage: 'An error occurred while updating the JWT secret.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="flex flex-auto flex-col content-between overflow-hidden pb-4"
      >
        <div className="flex-auto overflow-y-auto px-6">
          <Input
            {...register('jwtSecret')}
            error={Boolean(errors.jwtSecret?.message)}
            helperText={errors.jwtSecret?.message}
            autoFocus={!disabled}
            disabled={disabled}
            aria-label="JWT Secret"
            multiline
            minRows={4}
            fullWidth
            hideEmptyHelperText
            slotProps={{ inputRoot: { className: 'font-mono !text-sm' } }}
          />
        </div>

        <div className="grid flex-shrink-0 grid-flow-row gap-2 px-6 pt-4">
          {!disabled && (
            <Button
              loading={isSubmitting}
              disabled={isSubmitting}
              type="submit"
            >
              {submitButtonText}
            </Button>
          )}

          <Button
            variant="outlined"
            color="secondary"
            onClick={onCancel}
            tabIndex={isDirty ? -1 : 0}
            autoFocus={disabled}
          >
            {disabled ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}
