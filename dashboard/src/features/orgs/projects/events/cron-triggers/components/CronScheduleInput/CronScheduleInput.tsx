import type { ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/v3/form';
import { CronScheduleInput as CronScheduleControl } from '@/features/orgs/projects/events/common/components/CronScheduleInput';
import { cn } from '@/lib/utils';

const inputClasses =
  '!bg-transparent aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500';

interface CronScheduleInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label: ReactNode;
  placeholder?: string;
  className?: string;
  containerClassName?: string;
}

export default function CronScheduleInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  placeholder,
  className = '',
  containerClassName = '',
}: CronScheduleInputProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn(containerClassName)}>
          <FormControl>
            <CronScheduleControl
              scheduler="hasura"
              timezone="UTC"
              label={label}
              ref={field.ref}
              name={field.name}
              value={typeof field.value === 'string' ? field.value : ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder={placeholder}
              className={cn(inputClasses, className)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
