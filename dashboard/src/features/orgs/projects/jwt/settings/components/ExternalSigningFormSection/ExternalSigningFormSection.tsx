import { Input } from '@/components/ui/v2/Input';
import { Label } from '@/components/ui/v3/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import { useFormContext } from 'react-hook-form';

import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { Text } from '@/components/ui/v2/Text';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  ASYMMETRIC_ALGORITHMS,
  type ExternalSigningType,
  type JWTSettingsFormValues,
} from '@/features/orgs/projects/jwt/settings/types';
import { useGetJwtSecretsQuery } from '@/utils/__generated__/graphql';
import { useState } from 'react';

export default function ExternalSigningFormSection() {
  const {
    register,
    formState: { errors },
    setValue,
    watch,
  } = useFormContext<JWTSettingsFormValues>();

  const type = watch('type');

  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data } = useGetJwtSecretsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-only',
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });
  const { jwk_url } = data?.config?.hasura?.jwtSecrets?.[0] || {};

  const initialExternalSigningType: ExternalSigningType = jwk_url
    ? 'jwk-endpoint'
    : 'public-key';

  const [externalSigningType, setExternalSigningType] =
    useState<ExternalSigningType>(initialExternalSigningType);

  const handleExternalSigningTypeChange = (value: ExternalSigningType) => {
    setExternalSigningType(value);
  };

  return (
    <div className="flex flex-col gap-6">
      <Alert severity="warning">
        <Text>
          When using external signing the Auth service will be automatically
          disabled.
        </Text>
      </Alert>
      <Box className="grid grid-cols-5 gap-4">
        <div className="col-span-5">
          <RadioGroup
            defaultValue="jwk-endpoint"
            value={externalSigningType}
            onValueChange={handleExternalSigningTypeChange}
            className="flex flex-row"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="jwk-endpoint" id="jwk-endpoint" />
              <Label htmlFor="jwk-endpoint">JWK Endpoint</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="public-key" id="public-key" />
              <Label htmlFor="public-key">Public Key</Label>
            </div>
          </RadioGroup>
        </div>
        {externalSigningType === 'jwk-endpoint' && (
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
        )}
        {externalSigningType === 'public-key' && (
          <>
            <Select
              id="type"
              className="col-span-5 lg:col-span-2"
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
        )}
      </Box>
    </div>
  );
}
