import { AsymmetricKeyFormSection } from '@/features/orgs/projects/jwt/settings/components/AsymmetricKeyFormSection';
import { SymmetricKeyFormSection } from '@/features/orgs/projects/jwt/settings/components/SymmetricKeyFormSection';
import { ThirdPartySecretFormSection } from '@/features/orgs/projects/jwt/settings/components/ThirdPartySecretFormSection';
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
  if (secretType === 'third-party') {
    return <ThirdPartySecretFormSection />;
  }
  return null;
}
