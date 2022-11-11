import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import type { ChangeEvent, MouseEventHandler, ReactNode } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useFormContext } from 'react-hook-form';

export interface CreatePermissionVariableBaseFormData {
  key: string;
  value: string;
}

export interface CreateModalBaseProps<T> {
  /**
   * Title of this modal.
   */
  title: string;
  /**
   * Type of this modal.
   */
  type?: 'create' | 'edit';
  /**
   * Callback to be called when the modal is closed.
   */
  onClose?: VoidFunction;
  /**
   * Callback to be called when remove button is clicked.
   */
  onRemove?: MouseEventHandler<HTMLButtonElement>;
  /**
   * Callback to be called when the form is submitted.
   */
  onSubmit: SubmitHandler<T>;
  /**
   * Error to be displayed.
   */
  errorComponent?: ReactNode;
}

export type CreatePermissionVariableModalBaseProps =
  CreateModalBaseProps<CreatePermissionVariableBaseFormData>;

export default function CreatePermissionVariableModalBase({
  title,
  type,
  onClose,
  onRemove,
  onSubmit,
  errorComponent,
}: CreatePermissionVariableModalBaseProps) {
  const {
    handleSubmit,
    watch,
    register,
    formState: { isSubmitting, errors },
  } = useFormContext<CreatePermissionVariableBaseFormData>();

  const keyHandlers = register('key', {
    required: true,
    pattern: {
      value: /^[a-zA-Z-]+$/i,
      message: 'Must contain only letters and hyphens',
    },
  });

  const valueHandlers = register('value', {
    required: true,
    pattern: {
      value: /^[a-zA-Z0-9._[\]]+$/i,
      message: 'Must contain only letters, dots, brackets, and underscores',
    },
  });

  const isComplete = !!watch('key') && !!watch('value');

  return (
    <div className="w-modal p-6 text-left">
      <div className="grid w-full grid-flow-col items-center justify-between">
        <Text variant="h3" component="h2">
          {title}
        </Text>

        {type === 'edit' && onRemove && (
          <Button variant="borderless" color="error" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>

      <Text className="mt-2 text-sm+ text-greyscaleDark">
        Enter the field name and the path you want to use in this permission
        variable.
      </Text>

      {errorComponent}

      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
        <div className="my-4 grid grid-flow-row divide-y-1 divide-solid divide-gray-200 border-y border-gray-200">
          <Input
            {...keyHandlers}
            value={watch('key')}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              if (
                event.target.value &&
                !/^[a-zA-Z-]+$/gi.test(event.target.value)
              ) {
                // prevent the user from entering invalid characters
                return;
              }

              keyHandlers.onChange(event);
            }}
            id="key"
            variant="inline"
            inlineInputProportion="66%"
            label="Field name"
            fullWidth
            startAdornment={
              <Text className="min-w-[73px] text-sm+ text-greyscaleGrey">
                X-Hasura-
              </Text>
            }
            componentsProps={{
              inputWrapper: { className: 'my-1' },
              input: {
                className: 'border-transparent focus-within:border-solid pl-2',
              },
              inputRoot: { className: '!pl-[1px]' },
            }}
            autoFocus
            error={!!errors?.key?.message}
            helperText={errors?.key?.message}
            hideEmptyHelperText
          />

          <Input
            {...valueHandlers}
            value={watch('value')}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              if (
                event.target.value &&
                !/^[a-zA-Z-]+$/gi.test(event.target.value)
              ) {
                // prevent the user from entering invalid characters
                return;
              }

              valueHandlers.onChange(event);
            }}
            id="value"
            variant="inline"
            inlineInputProportion="66%"
            label="Path"
            fullWidth
            startAdornment={
              <Text className="text-sm+ text-greyscaleGrey">user.</Text>
            }
            componentsProps={{
              inputWrapper: { className: 'my-1' },
              input: {
                className: 'border-transparent focus-within:border-solid pl-2',
              },
              inputRoot: { className: '!pl-[1px]' },
            }}
            error={!!errors?.value?.message}
            helperText={errors?.value?.message}
            hideEmptyHelperText
          />
        </div>

        <div className="grid gap-2">
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting || !isComplete}
          >
            {type === 'create' ? 'Create Permission Variable' : 'Save Changes'}
          </Button>

          <Button variant="outlined" color="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </form>
    </div>
  );
}
