import { Input } from '@/components/ui/v2/Input';
import { useFormContext } from 'react-hook-form';

import { Box } from '@/components/ui/v2/Box';
import type { JWTSettingsFormValues } from '@/features/orgs/projects/jwt/settings/types';

export default function ThirdPartySecretFormSection() {
  const {
    register,
    formState: { errors },
  } = useFormContext<JWTSettingsFormValues>();

  return (
    <Box className="grid grid-cols-3 gap-4">
      <Input
        {...register('jwkUrl')}
        name="jwkUrl"
        id="jwkUrl"
        placeholder="https://acme.com/jwk"
        className="col-span-2"
        label="JWK URL"
        fullWidth
        hideEmptyHelperText
        error={!!errors?.jwkUrl}
        helperText={errors?.jwkUrl?.message}
      />
    </Box>
  );
}
