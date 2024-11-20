import type { JWTSecretType } from '@/features/orgs/projects/jwt/settings/types';
import { SymmetricKeyFormSection } from '../SymmetricKeyFormSection';

interface JWTSecretFieldProps {
  secretType: JWTSecretType;
}

export default function JWTSecretField({ secretType }: JWTSecretFieldProps) {
  if (secretType === 'symmetric') {
    return <SymmetricKeyFormSection />;
  }
  if (secretType === 'asymmetric') {
    return <div>Asymmetric</div>;
  }
  if (secretType === 'third-party') {
    return <div>Third party</div>;
  }
  return null;
}
