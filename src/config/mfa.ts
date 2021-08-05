import { castBooleanEnv } from '@config/utils';

// Multi-Factor Authentication configuration
export const MFA = {
  get ENABLED() {
    return (
      castBooleanEnv('MFA_ENABLED') || castBooleanEnv('MFA_ENABLE') || true
    );
  },
  get OTP_ISSUER() {
    return process.env.OTP_ISSUER || 'HBP';
  },
};
