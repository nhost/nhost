import { cn, isNotEmptyValue } from '@/lib/utils';

interface HttpStatusTextProps {
  status?: number | null;
  className?: string;
}
export default function HttpStatusText({
  status,
  className,
}: HttpStatusTextProps) {
  return (
    <span
      className={cn(
        'font-mono text-xs text-yellow-600 dark:text-yellow-400',
        {
          'text-green-600 dark:text-green-400':
            isNotEmptyValue(status) && status >= 200 && status < 300,
          'text-red-600 dark:text-red-400':
            isNotEmptyValue(status) && status >= 400,
        },
        className,
      )}
    >
      {status ?? 'NULL'}
    </span>
  );
}
