import { cn } from '@/lib/utils';

interface HttpStatusTextProps {
  status?: number | null;
  className?: string;
}
export default function HttpStatusText({
  status,
  className,
}: HttpStatusTextProps) {
  if (!status) {
    return (
      <span className={cn('font-mono text-xs text-yellow-600', className)}>
        NULL
      </span>
    );
  }
  if (status >= 200 && status < 300) {
    return (
      <span className={cn('font-mono text-xs text-green-600', className)}>
        {status}
      </span>
    );
  }
  if (status >= 400) {
    return (
      <span className={cn('font-mono text-xs text-red-600', className)}>
        {status}
      </span>
    );
  }
  return (
    <span className={cn('font-mono text-xs text-yellow-600', className)}>
      {status}
    </span>
  );
}
