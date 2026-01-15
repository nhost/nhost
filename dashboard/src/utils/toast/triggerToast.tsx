import type { ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

export default function triggerToast(text: ReactNode) {
  toast.custom(
    (t) => (
      <div
        className={cn(
          'rounded-sm+ px-2 py-1.5 text-center font-normal text-white shadow-md',
          t.visible ? 'animate-enter' : 'animate-leave',
        )}
        style={{ backgroundColor: 'rgb(55 65 81)' }}
      >
        {text}
      </div>
    ),
    {
      id: typeof text === 'string' ? text : '',
    },
  );
}
