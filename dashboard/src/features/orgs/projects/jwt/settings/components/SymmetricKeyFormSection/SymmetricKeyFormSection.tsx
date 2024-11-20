import { Input } from '@/components/ui/v2/Input';
import { useFormContext } from 'react-hook-form';

import { Box } from '@/components/ui/v2/Box';
import type { JWTSettingsFormValues } from '@/features/orgs/projects/jwt/settings/types';

export default function SymmetricKeyFormSection() {
  const {
    register,
    formState: { errors },
  } = useFormContext<JWTSettingsFormValues>();

  return (
    <Box className="grid grid-cols-3 gap-4">
      <Input
        {...register('type')}
        name="type"
        id="type"
        placeholder="HS256"
        className="col-span-2"
        label="Hashing algorithm"
        fullWidth
        hideEmptyHelperText
        error={!!errors?.type}
        helperText={errors?.type?.message}
      />
      <Input
        {...register('key')}
        name="key"
        id="key"
        label="Key"
        placeholder="This is a secret key that will be used to sign the JWT token."
        className="col-span-2"
        fullWidth
        hideEmptyHelperText
        error={!!errors?.key}
        helperText={errors?.key?.message}
      />
    </Box>
  );
}
