import { ASYMMETRIC_ALGORITHMS } from '@/features/orgs/projects/jwt/settings/utils/constants';
import { useFormContext } from 'react-hook-form';

import { Input } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import type {
  ExternalSigningType,
  JWTSettingsFormValues,
} from '@/features/orgs/projects/jwt/settings/types';

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
        <Select
          id="type"
          className="col-span-5 lg:col-span-1"
          placeholder="RS256"
          hideEmptyHelperText
          variant="normal"
          defaultValue={ASYMMETRIC_ALGORITHMS[0]}
          error={!!errors.type}
          helperText={errors?.type?.message}
          label="Hashing algorithm"
          value={type}
          onChange={(_event, value) =>
            setValue('type', value as string, { shouldDirty: true })
          }
        >
          {ASYMMETRIC_ALGORITHMS.map((algorithm) => (
            <Option key={algorithm} value={algorithm}>
              {algorithm}
            </Option>
          ))}
        </Select>
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
