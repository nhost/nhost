import { createClient } from '@nhost/nhost-js';

export const nhost = createClient({
  subdomain: import.meta.env['VITE_NHOST_SUBDOMAIN'] ?? 'local',
  region: import.meta.env['VITE_NHOST_REGION'] ?? 'local',
});
