import { ChevronDown } from 'lucide-react';

interface ReadOnlySelectProps {
  label: string;
  value: string;
}

export default function ReadOnlySelect({ label, value }: ReadOnlySelectProps) {
  return (
    <div className="space-y-2">
      <span className="font-medium text-sm leading-none">{label}</span>
      <div>
        <div className="inline-flex h-10 w-full cursor-not-allowed items-center justify-between whitespace-nowrap rounded-md border bg-background px-4 py-2 font-normal text-sm opacity-50">
          {value}
          <ChevronDown className="ml-2 size-4 opacity-50" />
        </div>
      </div>
    </div>
  );
}
