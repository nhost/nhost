// import { Button } from '@/components/ui/v2/Button';
import { ChevronDownIcon } from '@/components/ui/v2/icons/ChevronDownIcon';
import { ChevronUpIcon } from '@/components/ui/v2/icons/ChevronUpIcon';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { XIcon } from '@/components/ui/v2/icons/XIcon';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { getToastBackgroundColor } from '@/utils/constants/settings';
import { copy } from '@/utils/copy';
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

export default function ErrorToast({
  isVisible,
  errorMessage,
  error,
  close,
}: {
  isVisible: boolean;
  errorMessage: string;
  error: Error;
  close: () => void;
}) {
  const { id } = useUserData();
  const { asPath } = useRouter();

  const [showInfo, setShowInfo] = useState(false);
  const { currentProject } = useCurrentWorkspaceAndProject();

  const errorDetails: ErrorDetails = {
    info: {
      projectId: currentProject.id,
      userId: id,
      url: asPath,
    },
    error,
  };

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
          <div className="flex flex-row items-center justify-between w-full space-x-4">
            <button onClick={close} type="button">
              <XIcon className="w-4 h-4 text-white" />
            </button>
            <span>
              {errorMessage ??
                'An unkown error has occured, please try again later!'}
            </span>

            <button
              type="button"
              onClick={() => setShowInfo(!showInfo)}
              className="flex flex-row items-center justify-center space-x-2 text-white"
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
                  className="absolute top-2 right-2"
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
