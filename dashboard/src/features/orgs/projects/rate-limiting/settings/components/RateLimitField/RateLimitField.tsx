import { useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { SelectItem } from '@/components/ui/v3/select';
import { intervalUnitOptions } from '@/features/orgs/projects/rate-limiting/settings/components/validationSchemas';

interface RateLimitFieldProps {
  disabled?: boolean;
  title?: string;
  id: string;
}

export default function RateLimitField({
  disabled,
  id,
  title,
}: RateLimitFieldProps) {
  const { control } = useFormContext();

  return (
    <div className="px-4">
      {title ? <p className="py-4 font-semibold">{title}</p> : null}
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex flex-row items-center gap-2">
          <span>Limit</span>
          <FormInput
            control={control}
            name={`${id}.limit`}
            disabled={disabled}
            type="number"
            placeholder=""
            containerClassName="max-w-60"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-row items-center gap-2">
          <span>Interval</span>
          <FormInput
            control={control}
            name={`${id}.interval`}
            disabled={disabled}
            type="number"
            placeholder=""
            containerClassName="max-w-32"
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
    </div>
  );
}
