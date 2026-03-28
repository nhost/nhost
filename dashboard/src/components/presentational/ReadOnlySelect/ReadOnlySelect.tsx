import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

interface ReadOnlySelectProps {
  label: ReactNode;
  value: ReactNode;
}

export default function ReadOnlySelect({ label, value }: ReadOnlySelectProps) {
  return (
    <div className="space-y-2">
      <span className="font-medium text-sm leading-none">{label}</span>
      <div>
        <div className="inline-flex h-10 w-full cursor-not-allowed items-center justify-between gap-2 rounded-md border bg-background px-4 py-2 font-normal text-sm opacity-50">
          <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate">
            {value}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </div>
      </div>
    </div>
  );
}
