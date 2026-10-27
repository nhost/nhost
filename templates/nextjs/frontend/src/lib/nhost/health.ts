import { generateServiceUrl } from '@nhost/nhost-js';
import { nhostRegion, nhostSubdomain } from './env';

// How long the backend gets to answer before it counts as offline. A stopped
// local stack refuses the connection at once; this is for one that hangs.
const TIMEOUT_MS = 5000;

/**
 * Whether the backend answers right now, asked of the auth service's health
 * endpoint.
 */
export const isBackendReachable = async (): Promise<boolean> => {
  const url = `${generateServiceUrl('auth', nhostSubdomain(), nhostRegion())}/healthz`;

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
};
