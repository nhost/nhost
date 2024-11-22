import { Label } from '@/components/ui/v3/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';

import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';

import { ExternalSigningField } from '@/features/orgs/projects/jwt/settings/components/ExternalSigningField';
import type { ExternalSigningType } from '@/features/orgs/projects/jwt/settings/types';

interface ExternalSigningFormSectionProps {
  externalSigningType: ExternalSigningType;
  handleExternalSigningTypeChange: (value: ExternalSigningType) => void;
}

export default function ExternalSigningFormSection({
  externalSigningType,
  handleExternalSigningTypeChange,
}: ExternalSigningFormSectionProps) {
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
            className="flex flex-col gap-4 lg:flex-row"
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
        <ExternalSigningField externalSigningType={externalSigningType} />
      </Box>
    </div>
  );
}
