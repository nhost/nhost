import { useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import type { JWTSettingsFormValues } from '@/features/orgs/projects/jwt/settings/types';
import { SYMMETRIC_ALGORITHMS } from '@/features/orgs/projects/jwt/settings/utils/constants';

export default function SymmetricKeyFormSection() {
  const {
    control,
    formState: { errors },
    watch,
    setValue,
  } = useFormContext<JWTSettingsFormValues>();

  const type = watch('type');

  return (
    <div className="grid grid-cols-5 gap-4">
      <FormField
        control={control}
        name="type"
        render={() => (
          <FormItem className="col-span-5 lg:col-span-1">
            <FormLabel>Hashing algorithm</FormLabel>
            <Select
              value={type ?? ''}
              onValueChange={(value) =>
                setValue('type', value, { shouldDirty: true })
              }
            >
              <FormControl>
                <SelectTrigger
                  id="type"
                  aria-invalid={!!errors.type}
                  className="aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500"
                >
                  <SelectValue placeholder={SYMMETRIC_ALGORITHMS[0]} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {SYMMETRIC_ALGORITHMS.map((algorithm) => (
                  <SelectItem key={algorithm} value={algorithm}>
                    {algorithm}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormInput
        control={control}
        name="key"
        label="Key"
        placeholder="Enter symmetric key"
        containerClassName="col-span-5 lg:col-span-3"
      />
    </div>
  );
}
