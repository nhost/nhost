import { AsymmetricKeyFormSection } from '@/features/orgs/projects/jwt/settings/components/AsymmetricKeyFormSection';
import { ExternalSigningFormSection } from '@/features/orgs/projects/jwt/settings/components/ExternalSigningFormSection';
import { SymmetricKeyFormSection } from '@/features/orgs/projects/jwt/settings/components/SymmetricKeyFormSection';
import type {
  ExternalSigningType,
  JWTSecretType,
} from '@/features/orgs/projects/jwt/settings/types';

interface JWTSecretFieldProps {
  secretType: JWTSecretType;
  externalSigningType: ExternalSigningType;
  handleExternalSigningTypeChange: (value: ExternalSigningType) => void;
}

export default function JWTSecretField({
  secretType,
  externalSigningType,
  handleExternalSigningTypeChange,
}: JWTSecretFieldProps) {
  if (secretType === 'symmetric') {
    return <SymmetricKeyFormSection />;
  }
  if (secretType === 'asymmetric') {
    return <AsymmetricKeyFormSection />;
  }
  if (secretType === 'external') {
    return (
      <ExternalSigningFormSection
        externalSigningType={externalSigningType}
        handleExternalSigningTypeChange={handleExternalSigningTypeChange}
      />
    );
  }
  return null;
}
