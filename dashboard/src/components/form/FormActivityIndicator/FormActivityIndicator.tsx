import { Spinner } from '@/components/ui/v3/spinner';
import { cn } from '@/lib/utils';

export interface FormActivityIndicatorProps {
  className?: string;
}

export default function FormActivityIndicator({
  className,
  ...props
}: FormActivityIndicatorProps) {
  return (
    <div
      {...props}
      className={cn(
        'box grid h-full items-center justify-center px-6 py-4',
        className,
      )}
    >
      <Spinner className="h-5 w-5" wrapperClassName="flex-row gap-1">
        Loading form...
      </Spinner>
    </div>
  );
}
