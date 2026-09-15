'use client';

import { createClient } from '@nhost/nhost-js';
import { CookieStorage } from '@nhost/nhost-js/session';

export const nhost = createClient({
  subdomain: process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN ?? 'local',
  region: process.env.NEXT_PUBLIC_NHOST_REGION ?? 'local',
  storage: new CookieStorage({
    secure: process.env.NODE_ENV === 'production',
  }),
});
