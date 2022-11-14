import Loading from '@/ui/Loading';
import clsx from 'clsx';
import type { ToastOptions } from 'react-hot-toast';
import toast from 'react-hot-toast';

export function triggerToast(string: string) {
  toast.custom((t) => (
    <div
      className={clsx(
        'rounded-sm+ bg-greyscaleDark px-2 py-1.5 font-normal text-white shadow-md',
        t.visible ? 'animate-enter' : 'animate-leave',
      )}
    >
      {string}
    </div>
  ));
}

export function showLoadingToast(message: string, opts?: ToastOptions) {
  return toast.custom(
    ({ visible }) => (
      <div
        className={clsx(
          'grid grid-flow-col gap-2 rounded-sm+ bg-greyscaleDark px-2 py-1.5 font-normal text-white shadow-md',
          visible ? 'animate-enter' : 'animate-leave',
        )}
      >
        <Loading color="white" />

        {message}
      </div>
    ),
    opts,
  );
}
