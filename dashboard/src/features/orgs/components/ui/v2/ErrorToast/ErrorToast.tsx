import { ChevronDownIcon } from '@/components/ui/v2/icons/ChevronDownIcon';
import { ChevronUpIcon } from '@/components/ui/v2/icons/ChevronUpIcon';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { XIcon } from '@/components/ui/v2/icons/XIcon';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getToastBackgroundColor } from '@/utils/constants/settings';
import { copy } from '@/utils/copy';
import type { ApolloError } from '@apollo/client';
import { useUserData } from '@nhost/nextjs';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/router';
import { useState } from 'react';

interface ErrorDetails {
  info: {
    projectId: string;
    userId: string;
    url?: string;
  };
  error: any;
}

const getInternalErrorMessage = (
  error: Error | ApolloError | undefined,
): string | null => {
  if (!error) {
    return null;
  }

  if (error.name === 'ApolloError') {
    // @ts-ignore
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
  isVisible,
  errorMessage,
  error,
  close,
}: {
  isVisible: boolean;
  errorMessage: string;
  error: ApolloError | Error;
  close: () => void;
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
    <AnimatePresence>
      {isVisible && (
        <motion.div
          style={{
            backgroundColor: getToastBackgroundColor(),
          }}
          className="flex flex-col w-full max-w-xl p-4 space-y-4 text-white rounded-lg"
          initial={{
            opacity: 0,
            y: 100,
          }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            scale: 0,
            y: 100,
          }}
          transition={{
            bounce: 0.1,
          }}
        >
          <div className="flex flex-row items-center justify-between w-full gap-4">
            <button
              className="flex-shrink-0"
              onClick={close}
              type="button"
              aria-label="Close"
            >
              <XIcon className="w-4 h-4 text-white" />
            </button>
            <span className="flex-grow overflow-hidden break-words">
              {msg ?? 'An unkown error has occured, please try again later!'}
            </span>

            <button
              type="button"
              onClick={() => setShowInfo(!showInfo)}
              className="flex flex-row items-center justify-center flex-shrink-0 space-x-2 text-white"
              aria-label="Show error details"
            >
              <span>Info</span>
              {showInfo ? (
                <ChevronUpIcon className="w-3 h-3 text-white" />
              ) : (
                <ChevronDownIcon className="w-3 h-3 text-white" />
              )}
            </button>
          </div>

          {showInfo && (
            <div className="flex flex-col space-y-4">
              <div className="relative flex flex-col">
                <div className="relative flex max-h-[400px] w-full max-w-xl flex-row justify-between overflow-x-auto rounded-lg bg-black p-4">
                  <pre>{JSON.stringify(errorDetails, null, 2)}</pre>
                </div>
                <button
                  type="button"
                  aria-label="Copy error details"
                  className="absolute right-2 top-2"
                  onClick={(event) => {
                    event.stopPropagation();
                    copy(
                      JSON.stringify(errorDetails, null, 2),
                      'Error details',
                    );
                  }}
                >
                  <CopyIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
