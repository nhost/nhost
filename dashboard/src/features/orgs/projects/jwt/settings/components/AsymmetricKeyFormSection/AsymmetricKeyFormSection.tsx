import { Input } from '@/components/ui/v2/Input';
import { useFormContext } from 'react-hook-form';

import { Box } from '@/components/ui/v2/Box';
import { Option } from '@/components/ui/v2/Option';
import { type JWTSettingsFormValues } from '@/features/orgs/projects/jwt/settings/types';

import { Select } from '@/components/ui/v2/Select';
import { ASYMMETRIC_ALGORITHMS } from '@/features/orgs/projects/jwt/settings/types';

export default function AsymmetricKeyFormSection() {
  const {
    register,
    formState: { errors },
    watch,
    setValue,
  } = useFormContext<JWTSettingsFormValues>();

  const type = watch('type');

  console.log('atype:', type);

  return (
    <Box className="grid grid-cols-5 gap-4">
      <Select
        id="type"
        className="col-span-1 lg:col-span-1"
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
      <Input
        {...register('key')}
        name="key"
        id="key"
        label="Key"
        placeholder="Enter public key"
        className="col-span-3 lg:col-span-2"
        fullWidth
        hideEmptyHelperText
        error={!!errors?.key}
        helperText={errors?.key?.message}
      />
      <Input
        {...register('signingKey')}
        name="signingKey"
        id="signingKey"
        label="Signing key"
        placeholder="Enter private signing key"
        className="col-span-3 lg:col-span-2"
        fullWidth
        hideEmptyHelperText
        error={!!errors?.signingKey}
        helperText={errors?.signingKey?.message}
      />
      <Input
        {...register('kid')}
        name="kid"
        id="kid"
        label="Key ID"
        placeholder="Enter unique key ID (optional)"
        className="col-span-3 lg:col-span-2"
        fullWidth
        hideEmptyHelperText
        error={!!errors?.kid}
        helperText={errors?.kid?.message}
      />
    </Box>
  );
}
