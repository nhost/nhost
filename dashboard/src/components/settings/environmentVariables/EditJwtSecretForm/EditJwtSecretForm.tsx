import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import {
  refetchGetAppInjectedVariablesQuery,
  useUpdateApplicationMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

export interface EditJwtSecretFormProps {
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

export interface EditJwtSecretFormValues {
  /**
   * JWT secret.
   */
  jwtSecret: string;
}

const validationSchema = Yup.object().shape({
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

export default function EditJwtSecretForm({
  disabled,
  jwtSecret,
  onSubmit,
  onCancel,
  submitButtonText = 'Save',
}: EditJwtSecretFormProps) {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApplication] = useUpdateApplicationMutation({
    refetchQueries: [
      refetchGetAppInjectedVariablesQuery({ id: currentApplication?.id }),
    ],
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
    onDirtyStateChange(isDirty, 'dialog');
  }, [isDirty, onDirtyStateChange]);

  async function handleSubmit(values: EditJwtSecretFormValues) {
    const updateAppPromise = updateApplication({
      variables: {
        appId: currentApplication?.id,
        app: {
          hasuraGraphqlJwtSecret: values.jwtSecret,
        },
      },
    });

    await toast.promise(
      updateAppPromise,
      {
        loading: 'Updating JWT secret...',
        success: 'JWT secret has been updated successfully.',
        error: 'An error occurred while updating the JWT secret.',
      },
      getToastStyleProps(),
    );

    onSubmit?.();
  }

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="flex flex-auto flex-col content-between overflow-hidden pb-4"
      >
        <div className="px-6 overflow-y-auto flex-auto">
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
