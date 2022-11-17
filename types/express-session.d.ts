import { UserRegistrationOptions } from '@/types';
import type { GrantSession } from 'grant';

// Augment express-session with a custom SessionData object
declare module 'express-session' {
  interface SessionData {
    grant: GrantSession;
    options: Partial<UserRegistrationOptions>;
    redirectTo: string;
  }
}
