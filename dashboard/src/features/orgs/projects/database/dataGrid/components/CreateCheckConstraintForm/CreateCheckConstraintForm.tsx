import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { useCreateCheckConstraintMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateCheckConstraintMutation';
import type { DialogFormProps } from '@/types/common';
import { triggerToast } from '@/utils/toast';

export interface CreateCheckConstraintFormValues {
  constraintName: string;
  checkExpression: string;
}

export interface CreateCheckConstraintFormProps extends DialogFormProps {
  /**
   * Schema where the table is located.
   */
  schema: string;
  /**
   * Table name.
   */
  table: string;
  /**
   * Function to be called when the constraint is created.
   */
  onSubmit?: () => Promise<void>;
}

const validationSchema = Yup.object({
  constraintName: Yup.string()
    .required('Constraint name is required.')
    .matches(
      /^([A-Za-z]|_)+/i,
      'Constraint name must start with a letter or underscore.',
    )
    .matches(
      /^\w+$/i,
      'Constraint name must contain only letters, numbers, or underscores.',
    ),
  checkExpression: Yup.string().required('Check expression is required.'),
});

export default function CreateCheckConstraintForm({
  schema,
  table,
  location,
  onSubmit: onSubmitCallback,
}: CreateCheckConstraintFormProps) {
  const { closeDialog, onDirtyStateChange } = useDialog();
  const {
    mutateAsync,
    error,
    reset: resetError,
  } = useCreateCheckConstraintMutation({
    schema,
    table,
  });

  const form = useForm<CreateCheckConstraintFormValues>({
    defaultValues: {
      constraintName: '',
      checkExpression: '',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  const {
    register,
    formState: { errors, isSubmitting, dirtyFields },
  } = form;

  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  async function handleSubmit(values: CreateCheckConstraintFormValues) {
    try {
      await mutateAsync({
        constraintName: values.constraintName,
        checkExpression: values.checkExpression,
      });

      triggerToast('Check constraint created successfully.');

      if (onSubmitCallback) {
        await onSubmitCallback();
      }

      closeDialog();
    } catch {
      // Error is handled by the mutation
    }
  }

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="flex flex-auto flex-col content-between overflow-hidden border-t-1"
      >
        <div className="flex-auto space-y-4 overflow-y-auto p-6">
          {error && error instanceof Error && (
            <Alert
              severity="error"
              className="grid grid-flow-col items-center justify-between px-4 py-3"
            >
              <span className="text-left">
                <strong>Error:</strong> {error.message}
              </span>

              <Button
                variant="borderless"
                color="error"
                size="small"
                onClick={resetError}
              >
                Clear
              </Button>
            </Alert>
          )}

          <Input
            {...register('constraintName')}
            id="constraintName"
            fullWidth
            label="Constraint Name"
            placeholder="e.g., chk_positive_price"
            helperText={
              typeof errors.constraintName?.message === 'string'
                ? errors.constraintName?.message
                : ''
            }
            hideEmptyHelperText
            error={Boolean(errors.constraintName)}
            autoComplete="off"
            autoFocus
          />

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Text className="font-medium text-sm">Check Expression</Text>
              <Tooltip title="SQL boolean expression that must be true for all rows. Example: price > 0 AND quantity >= 0">
                <InfoIcon className="h-4 w-4 text-muted-foreground" />
              </Tooltip>
            </div>
            <textarea
              {...register('checkExpression')}
              id="checkExpression"
              rows={4}
              placeholder="e.g., price > 0 AND quantity >= 0"
              className="w-full rounded-md border border-input bg-input px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.checkExpression?.message && (
              <Text className="text-destructive text-xs">
                {errors.checkExpression.message}
              </Text>
            )}
          </div>
        </div>

        <Box className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 p-2">
          <Button
            variant="borderless"
            color="secondary"
            onClick={closeDialog}
            tabIndex={isDirty ? -1 : 0}
          >
            Cancel
          </Button>

          <Button
            loading={isSubmitting}
            disabled={isSubmitting}
            type="submit"
            className="justify-self-end"
          >
            Add Constraint
          </Button>
        </Box>
      </Form>
    </FormProvider>
  );
}
