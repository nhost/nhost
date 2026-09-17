'use client';

import { createClient } from '@nhost/nhost-js';
import { CookieStorage } from '@nhost/nhost-js/session';
import { nhostRegion, nhostSubdomain } from './env';

export const nhost = createClient({
  subdomain: nhostSubdomain(),
  region: nhostRegion(),
  storage: new CookieStorage({
    secure: process.env.NODE_ENV === 'production',
  }),
});
