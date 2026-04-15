import { cn } from '@/lib/utils';

interface ReadOnlyInputProps {
  value: string;
  className?: string;
}

export default function ReadOnlyInput({
  value,
  className,
}: ReadOnlyInputProps) {
  return (
    <div className="relative flex w-[202px] items-center">
      <div
        className={cn(
          'flex h-10 w-full cursor-not-allowed items-center rounded-md border border-input bg-background px-3 py-2 text-sm opacity-50 dark:bg-accent-background',
          className,
        )}
      >
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}
