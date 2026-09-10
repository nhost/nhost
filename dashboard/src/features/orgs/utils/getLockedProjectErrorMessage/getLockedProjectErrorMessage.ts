import { getErrorMessageSuffix } from '@/utils/databaseErrors';

export default function getLockedProjectErrorMessage(
  genericMessage: string,
): (error: Error) => string {
  return (error: Error): string => {
    const lockReason = getErrorMessageSuffix(error, 'app is locked: ');
    return lockReason ? `Project is locked: ${lockReason}` : genericMessage;
  };
}
