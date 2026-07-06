import {
  type FieldError,
  type FieldErrorsImpl,
  type Merge,
  type UseFormRegister,
  useFormContext,
} from 'react-hook-form';
import { FormSelect } from '@/components/form/FormSelect';
import { Box } from '@/components/ui/v2/Box';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { SelectItem } from '@/components/ui/v3/select';
import { intervalUnitOptions } from '@/features/orgs/projects/rate-limiting/settings/components/validationSchemas';

interface RateLimitFieldProps {
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  register: UseFormRegister<any>;
  errors?: Merge<
    FieldError,
    FieldErrorsImpl<{
      limit: number;
      interval: number;
      intervalUnit: string;
    }>
  >;
  disabled?: boolean;
  title?: string;
  id: string;
}

export default function RateLimitField({
  register,
  disabled,
  id,
  errors,
  title,
}: RateLimitFieldProps) {
  const { control } = useFormContext();

  return (
    <Box className="px-4">
      {title ? <Text className="py-4 font-semibold">{title}</Text> : null}
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex flex-row items-center gap-2">
          <Text>Limit</Text>
          <Input
            {...register(`${id}.limit`)}
            disabled={disabled}
            id={`${id}.limit`}
            type="number"
            placeholder=""
            className="max-w-60"
            hideEmptyHelperText
            error={!!errors?.limit}
            helperText={errors?.limit?.message}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-row items-center gap-2">
          <Text>Interval</Text>
          <Input
            {...register(`${id}.interval`)}
            disabled={disabled}
            id={`${id}.interval`}
            type="number"
            placeholder=""
            hideEmptyHelperText
            className="max-w-32"
            error={!!errors?.interval}
            helperText={errors?.interval?.message}
            autoComplete="off"
          />
          <FormSelect
            control={control}
            name={`${id}.intervalUnit`}
            disabled={disabled}
            className="w-27"
            containerClassName="space-y-0"
          >
            {intervalUnitOptions.map(({ value, label }) => (
              <SelectItem key={`${id}.intervalUnit.${value}`} value={value}>
                {label}
              </SelectItem>
            ))}
          </FormSelect>
        </div>
      </div>
    </Box>
  );
}
