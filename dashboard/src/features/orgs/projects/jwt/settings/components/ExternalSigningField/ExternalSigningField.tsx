import { useFormContext } from 'react-hook-form';
import { FormControl } from '@/components/ui/v2/FormControl';
import { Input } from '@/components/ui/v2/Input';
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
    register,
    formState: { errors },
    setValue,
    watch,
  } = useFormContext<JWTSettingsFormValues>();

  const type = watch('type');

  if (externalSigningType === 'jwk-endpoint') {
    return (
      <Input
        {...register('jwkUrl')}
        name="jwkUrl"
        id="jwkUrl"
        placeholder="https://acme.com/jwks.json"
        className="col-span-5 lg:col-span-4"
        label="JWK URL"
        fullWidth
        hideEmptyHelperText
        error={!!errors?.jwkUrl}
        helperText={errors?.jwkUrl?.message}
      />
    );
  }

  if (externalSigningType === 'public-key') {
    return (
      <>
        <FormControl
          className="col-span-5 lg:col-span-1"
          hideEmptyHelperText
          variant="normal"
          error={!!errors.type}
          helperText={errors?.type?.message}
          label="Hashing algorithm"
          labelProps={{ htmlFor: 'type' }}
        >
          <Select
            value={type ?? ''}
            onValueChange={(value) =>
              setValue('type', value, { shouldDirty: true })
            }
          >
            <SelectTrigger
              id="type"
              aria-invalid={!!errors.type}
              className="aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500"
            >
              <SelectValue placeholder={ASYMMETRIC_ALGORITHMS[0]} />
            </SelectTrigger>
            <SelectContent>
              {ASYMMETRIC_ALGORITHMS.map((algorithm) => (
                <SelectItem key={algorithm} value={algorithm}>
                  {algorithm}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormControl>
        <div className="lg:col-span-4" />

        <Input
          {...register('key')}
          name="key"
          id="key"
          placeholder="-----BEGIN PUBLIC KEY-----"
          className="col-span-5 lg:col-span-4"
          label="Public Key"
          fullWidth
          multiline
          hideEmptyHelperText
          error={!!errors?.key}
          helperText={errors?.key?.message}
          inputProps={{
            className: 'resize-y min-h-[130px]',
          }}
        />
      </>
    );
  }

  return null;
}
