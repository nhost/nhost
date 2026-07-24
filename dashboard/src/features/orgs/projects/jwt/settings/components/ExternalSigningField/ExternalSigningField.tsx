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
import type {
  ExternalSigningType,
  JWTSettingsFormValues,
} from '@/features/orgs/projects/jwt/settings/types';
import { ASYMMETRIC_ALGORITHMS } from '@/features/orgs/projects/jwt/settings/utils/constants';

interface ExternalSigningFieldProps {
  externalSigningType: ExternalSigningType;
}

export default function ExternalSigningField({
  externalSigningType,
}: ExternalSigningFieldProps) {
  const {
    control,
    formState: { errors },
    setValue,
    watch,
  } = useFormContext<JWTSettingsFormValues>();

  const type = watch('type');

  if (externalSigningType === 'jwk-endpoint') {
    return (
      <FormInput
        control={control}
        name="jwkUrl"
        placeholder="https://acme.com/jwks.json"
        containerClassName="col-span-5 lg:col-span-4"
        label="JWK URL"
      />
    );
  }

  if (externalSigningType === 'public-key') {
    return (
      <>
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
        <div className="lg:col-span-4" />

        <div className="col-span-5 lg:col-span-4">
          <FormTextarea
            control={control}
            name="key"
            placeholder="-----BEGIN PUBLIC KEY-----"
            label="Public Key"
            className="min-h-[130px] resize-y"
          />
        </div>
      </>
    );
  }

  return null;
}
