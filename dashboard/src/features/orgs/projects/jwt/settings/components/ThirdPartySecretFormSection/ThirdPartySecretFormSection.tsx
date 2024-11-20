import { Input } from '@/components/ui/v2/Input';
import { useFormContext } from 'react-hook-form';

import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import type { JWTSettingsFormValues } from '@/features/orgs/projects/jwt/settings/types';

export default function ThirdPartySecretFormSection() {
  const {
    register,
    formState: { errors },
  } = useFormContext<JWTSettingsFormValues>();

  return (
    <div className="flex flex-col gap-4">
      <Alert severity="warning">
        <Text>
          When using external signing the Auth service will be automatically
          disabled.
        </Text>
      </Alert>
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
    </div>
  );
}
