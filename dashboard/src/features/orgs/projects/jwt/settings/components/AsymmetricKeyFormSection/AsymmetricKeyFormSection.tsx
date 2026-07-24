import { useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import { FormTextarea } from '@/components/form/FormTextarea';
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
import { ASYMMETRIC_ALGORITHMS } from '@/features/orgs/projects/jwt/settings/utils/constants';

export default function AsymmetricKeyFormSection() {
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
                  <SelectValue placeholder={ASYMMETRIC_ALGORITHMS[0]} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {ASYMMETRIC_ALGORITHMS.map((algorithm) => (
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
        name="kid"
        label="Key ID"
        placeholder="Enter unique key ID"
        containerClassName="col-span-5 lg:col-span-3"
      />

      <div className="col-span-5 lg:col-span-4">
        <FormTextarea
          control={control}
          name="key"
          label="Public Key"
          placeholder="-----BEGIN PUBLIC KEY-----"
          className="min-h-[130px] resize-y"
        />
      </div>
      <div className="col-span-5 lg:col-span-4">
        <FormTextarea
          control={control}
          name="signingKey"
          label="Signing key"
          placeholder="-----BEGIN PRIVATE KEY-----"
          className="min-h-[130px] resize-y"
        />
      </div>
    </div>
  );
}
