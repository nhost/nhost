import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Input, type InputProps } from '@/components/ui/v3/input';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';

const inputClasses =
  '!bg-transparent aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500';

interface FormInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  placeholder?: string;
  className?: string;
  type?: string;
  disabled?: boolean;
  autoComplete?: InputProps['autoComplete'];
  infoTooltip?: string;
}

function FormInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  placeholder,
  className = '',
  type = 'text',
  disabled,
  autoComplete,
  infoTooltip,
}: FormInputProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {infoTooltip ? (
            <div className="flex flex-row items-center gap-2">
              <FormLabel>{label}</FormLabel>
              <FormDescription>
                <InfoTooltip>{infoTooltip}</InfoTooltip>
              </FormDescription>
            </div>
          ) : (
            <FormLabel>{label}</FormLabel>
          )}
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder || label}
              {...field}
              disabled={disabled}
              autoComplete={autoComplete}
              className={`${inputClasses} ${className}`}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export default FormInput;
