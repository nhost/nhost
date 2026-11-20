import type { ElevationMethod } from '@nhost/nhost-js/auth';
import type { LucideIcon } from 'lucide-react';
import { KeyRound, Mail, MessageSquare, Smartphone } from 'lucide-react';

export const elevationMethodDetails: Record<
  ElevationMethod,
  { label: string; description: string; icon: LucideIcon }
> = {
  webauthn: {
    label: 'Security key',
    description: 'Use a security key or your device biometrics',
    icon: KeyRound,
  },
  totp: {
    label: 'Authenticator app',
    description: 'Enter the code from your authenticator app',
    icon: Smartphone,
  },
  'otp-email': {
    label: 'Email',
    description: 'Get a one-time code by email',
    icon: Mail,
  },
  'otp-sms': {
    label: 'SMS',
    description: 'Get a one-time code by SMS',
    icon: MessageSquare,
  },
};
