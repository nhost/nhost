import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { RadioCard, RadioGroup } from '@/components/ui/v3/radio-group';

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
      <Alert variant="warning">
        <AlertDescription>
          When using external signing the Auth service will be automatically
          disabled.
        </AlertDescription>
      </Alert>
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-5">
          <RadioGroup
            defaultValue="jwk-endpoint"
            value={externalSigningType}
            onValueChange={handleExternalSigningTypeChange}
            className="grid gap-3 lg:grid-cols-2"
          >
            <RadioCard
              value="jwk-endpoint"
              title="JWK endpoint"
              description="Verify JWTs with the public keys published at a JWK URL."
            />
            <RadioCard
              value="public-key"
              title="Public key"
              description="Verify JWTs with a public key you paste in directly."
            />
          </RadioGroup>
        </div>
        <ExternalSigningField externalSigningType={externalSigningType} />
      </div>
    </div>
  );
}
