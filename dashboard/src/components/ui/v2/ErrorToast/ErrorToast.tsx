import type { ApolloError } from '@apollo/client';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { ChevronDownIcon } from '@/components/ui/v2/icons/ChevronDownIcon';
import { ChevronUpIcon } from '@/components/ui/v2/icons/ChevronUpIcon';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { XIcon } from '@/components/ui/v2/icons/XIcon';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useUserData } from '@/hooks/useUserData';
import { copy } from '@/utils/copy';

interface ErrorDetails {
  info: {
    projectId: string;
    userId: string;
    url?: string;
  };
  error: ApolloError | Error | object;
}

const getInternalErrorMessage = (
  error: Error | ApolloError | undefined,
): string | null => {
  if (!error) {
    return null;
  }

  if (error.name === 'ApolloError') {
    // @ts-expect-error
    const graphqlError = error.graphQLErrors?.[0];
    const graphqlExtensionsError = graphqlError?.extensions?.internal
      ?.error as { message: string };
    return graphqlExtensionsError?.message || graphqlError.message || null;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return null;
};

const errorToObject = (error: ApolloError | Error) => {
  if (error.name === 'ApolloError') {
    return error;
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {};
};

export default function ErrorToast({
  toastId,
  errorMessage,
  error,
}: {
  toastId: string;
  errorMessage: string;
  error: ApolloError | Error;
}) {
  const userData = useUserData();
  const { asPath } = useRouter();

  const [showInfo, setShowInfo] = useState(false);
  const { project } = useProject();

  const errorDetails: ErrorDetails = {
    info: {
      projectId: project?.id,
      userId: userData?.id || 'local',
      url: asPath,
    },
    error: errorToObject(error),
  };

  const msg = getInternalErrorMessage(error) || errorMessage;

  return (
    <div className="flex w-full flex-col gap-4 rounded-lg text-white">
      <div className="flex flex-row items-center justify-between gap-4">
        <button
          className="flex-shrink-0"
          onClick={() => toast.dismiss(toastId)}
          type="button"
          aria-label="Close"
        >
          <XIcon className="h-4 w-4 text-white" />
        </button>
        <span className="flex-grow overflow-hidden whitespace-normal break-words">
          {msg ?? 'An unkown error has occured, please try again later!'}
        </span>

        <button
          type="button"
          onClick={() => setShowInfo(!showInfo)}
          className="flex flex-shrink-0 flex-row items-center justify-center space-x-2 text-white"
          aria-label="Show error details"
        >
          <span>Info</span>
          {showInfo ? (
            <ChevronUpIcon className="h-3 w-3 text-white" />
          ) : (
            <ChevronDownIcon className="h-3 w-3 text-white" />
          )}
        </button>
      </div>

      {showInfo && (
        <div className="flex flex-col space-y-4">
          <div className="relative flex flex-col">
            <div className="relative flex max-h-[400px] w-full flex-row justify-between overflow-x-auto rounded-lg bg-black p-4">
              <pre>{JSON.stringify(errorDetails, null, 2)}</pre>
            </div>
            <button
              type="button"
              aria-label="Copy error details"
              className="absolute top-2 right-2"
              onClick={(event) => {
                event.stopPropagation();
                copy(JSON.stringify(errorDetails, null, 2), 'Error details');
              }}
            >
              <CopyIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
