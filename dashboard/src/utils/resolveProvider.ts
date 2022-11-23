import { capitalize } from './helpers';

export const resolveProvider = (providerId: string) => {
  if (providerId.toLowerCase() === 'microsoft') {
    return 'WindowsLive';
  }

  if (providerId.toLowerCase() === 'workos') {
    return 'WorkOs';
  }

  return capitalize(providerId);
};

export default resolveProvider;
