import { FetchError } from '@nhost/nhost-js/fetch';

export function getElevationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FetchError && error.status === 429) {
    return 'Too many attempts. Please wait a while and try again.';
  }

  return error instanceof Error && error.message ? error.message : fallback;
}
