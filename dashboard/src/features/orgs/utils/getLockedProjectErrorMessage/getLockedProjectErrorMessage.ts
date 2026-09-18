import { getErrorMessageSuffix } from '@/utils/databaseErrors';

/**
 * Builds an error message resolver that surfaces the reason a project is
 * locked, falling back to a generic message when the error is unrelated.
 */
export default function getLockedProjectErrorMessage(genericMessage: string) {
  return (error: Error): string => {
    const lockReason = getErrorMessageSuffix(error, 'app is locked: ');
    return lockReason ? `Project is locked: ${lockReason}` : genericMessage;
  };
}
