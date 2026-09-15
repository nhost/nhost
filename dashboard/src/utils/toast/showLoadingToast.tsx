import { Loader2 } from 'lucide-react';
import type { ToastOptions } from 'react-hot-toast';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

export default function showLoadingToast(message: string, opts?: ToastOptions) {
  return toast.custom(
    ({ visible }) => (
      <div
        className={cn(
          'loading-toast grid grid-flow-col gap-2 rounded-sm+ px-2 py-1.5 font-normal text-white shadow-md',
          visible ? 'animate-enter' : 'animate-leave',
        )}
      >
        <span className="flex flex-row items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="text-xs">{message}</span>
        </span>
      </div>
    ),
    opts,
  );
}
