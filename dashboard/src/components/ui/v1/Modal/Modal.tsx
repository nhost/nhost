import { ClientOnlyPortal } from '@/components/ui/v1/ClientOnlyPortal';
import { Box } from '@/components/ui/v2/Box';
import { Dialog, Transition } from '@headlessui/react';
import { alpha, useTheme } from '@mui/material';
import clsx from 'clsx';
import type { CSSProperties, ReactNode } from 'react';
import { Fragment } from 'react';
import { twMerge } from 'tailwind-merge';

export interface ModalProps {
  showModal: any;
  close: any;
  afterLeave?: VoidFunction;
  children?: ReactNode;
  Component?: any;
  handler?: any;
  data?: any;
  className?: string;
  wrapperClassName?: string;
  dialogClassName?: string;
  dialogStyle?: CSSProperties;
}

/**
 * @deprecated Use the `useDialog()` hook instead.
 */
export default function Modal({
  children,
  Component,
  showModal = false,
  close,
  afterLeave,
  handler,
  data,
  className,
  wrapperClassName,
  dialogClassName,
  dialogStyle,
}: ModalProps) {
  const theme = useTheme();

  return (
    <ClientOnlyPortal selector="#modal">
      <Transition.Root show={showModal} as="div">
        <Dialog
          as="div"
          static
          className={twMerge(
            'fixed inset-0 z-50 overflow-x-auto overflow-y-auto',
            dialogClassName,
          )}
          open={showModal}
          onClose={close}
          style={dialogStyle}
        >
          <div
            className={clsx(
              'flex min-h-screen items-center justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0',
              wrapperClassName,
            )}
          >
            <Transition.Child
              as={Fragment}
              afterLeave={afterLeave}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Dialog.Overlay
                className="fixed inset-0 transition-opacity"
                style={{
                  backgroundColor:
                    theme.palette.mode === 'dark'
                      ? alpha(theme.palette.common.black, 0.5)
                      : alpha(theme.palette.grey[400], 0.3),
                }}
              />
            </Transition.Child>
            <span className="hidden" aria-hidden="true">
              &#8203;
            </span>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Box
                className={clsx(
                  className ||
                    'mt-14 inline-block transform rounded-md shadow-xl transition-all',
                )}
                sx={{ backgroundColor: 'transparent' }}
              >
                {!children ? (
                  <Component close={close} handler={handler} data={data} />
                ) : (
                  children
                )}
              </Box>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
    </ClientOnlyPortal>
  );
}
