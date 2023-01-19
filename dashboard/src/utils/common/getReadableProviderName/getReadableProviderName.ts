import { capitalize } from '@/utils/helpers';

/**
 * Returns a readable provider name.
 *
 * @param providerId - Social provider ID.
 * @returns Readable provider name.
 */
export default function getReadableProviderName(providerId: string) {
  if (providerId === 'github') {
    return 'GitHub';
  }

  if (providerId === 'windowslive') {
    return 'Windows Live';
  }

  if (providerId === 'workos') {
    return 'WorkOS';
  }

  return capitalize(providerId);
}
