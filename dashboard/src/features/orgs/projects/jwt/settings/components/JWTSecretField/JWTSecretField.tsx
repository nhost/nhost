import { AsymmetricKeyFormSection } from '@/features/orgs/projects/jwt/settings/components/AsymmetricKeyFormSection';
import { ExternalSigningFormSection } from '@/features/orgs/projects/jwt/settings/components/ExternalSigningFormSection';
import { SymmetricKeyFormSection } from '@/features/orgs/projects/jwt/settings/components/SymmetricKeyFormSection';
import type { JWTSecretType } from '@/features/orgs/projects/jwt/settings/types';

interface JWTSecretFieldProps {
  secretType: JWTSecretType;
}

export default function JWTSecretField({ secretType }: JWTSecretFieldProps) {
  if (secretType === 'symmetric') {
    return <SymmetricKeyFormSection />;
  }
  if (secretType === 'asymmetric') {
    return <AsymmetricKeyFormSection />;
  }
  if (secretType === 'external') {
    return <ExternalSigningFormSection />;
  }
  return null;
}
