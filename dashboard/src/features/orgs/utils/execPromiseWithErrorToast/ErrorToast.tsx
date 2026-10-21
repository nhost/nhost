import type { ApolloError } from '@apollo/client';
import { isMetadataConflictError } from '@/features/orgs/utils/isMetadataConflictError';
import BaseErrorToast from './BaseErrorToast';
import MetadataConflictToast from './MetadataConflictToast';

export default function ErrorToast({
  toastId,
  errorMessage,
  error,
}: {
  toastId: string;
  errorMessage: string;
  error: ApolloError | Error;
}) {
  if (isMetadataConflictError(error)) {
    return <MetadataConflictToast toastId={toastId} error={error} />;
  }

  return (
    <BaseErrorToast toastId={toastId} error={error}>
      <span className="flex-grow overflow-hidden whitespace-normal break-words">
        {errorMessage ||
          'An unknown error has occurred, please try again later!'}
      </span>
    </BaseErrorToast>
  );
}
