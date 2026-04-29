import { cn } from '@/lib/utils';

export default function MetadataCard({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 p-4 dark:border-gray-700',
        className,
      )}
    >
      <h3 className="mb-3 flex items-center gap-2 text-muted-foreground text-sm">
        <Icon className="h-4 w-4" />
        {title}
      </h3>
      {children}
    </div>
  );
}
