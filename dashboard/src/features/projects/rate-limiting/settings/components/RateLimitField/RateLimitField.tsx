import { ControlledSelect } from '@/components/form/ControlledSelect';
import { Box } from '@/components/ui/v2/Box';
import { Input } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { Text } from '@/components/ui/v2/Text';
import { intervalUnitOptions } from '@/features/projects/rate-limiting/settings/components/validationSchemas';
import type {
  FieldError,
  FieldErrorsImpl,
  Merge,
  UseFormRegister,
} from 'react-hook-form';

interface RateLimitFieldProps {
  register: UseFormRegister<any>;
  errors: Merge<
    FieldError,
    FieldErrorsImpl<{
      limit: number;
      interval: number;
      intervalUnit: string;
    }>
  >;
  title?: string;
  id: string;
}

export default function RateLimitField({
  register,
  id,
  errors,
}: RateLimitFieldProps) {
  return (
    <Box className="flex flex-col gap-8 lg:flex-row">
      <div className="flex flex-row items-center gap-2">
        <Text>Limit</Text>
        <Input
          {...register(`${id}.limit`)}
          id={`${id}.limit`}
          type="number"
          placeholder=""
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
          id={`${id}.limit`}
          type="number"
          placeholder=""
          hideEmptyHelperText
          error={!!errors?.interval}
          helperText={errors?.interval?.message}
          autoComplete="off"
        />
        <ControlledSelect
          {...register(`${id}.intervalUnit`)}
          variant="normal"
          id={`${id}.intervalUnit`}
          defaultValue="m"
          hideEmptyHelperText
        >
          {intervalUnitOptions.map(({ value, label }) => (
            <Option key={`${id}.intervalUnit.${value}`} value={value}>
              {label}
            </Option>
          ))}
        </ControlledSelect>
      </div>
    </Box>
  );
}
