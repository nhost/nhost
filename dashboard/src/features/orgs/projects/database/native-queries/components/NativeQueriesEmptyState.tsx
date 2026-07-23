import { Boxes } from 'lucide-react';
import type { ReactNode } from 'react';

interface NativeQueriesEmptyStateProps {
  title: ReactNode;
  description: ReactNode;
}

export default function NativeQueriesEmptyState({
  title,
  description,
}: NativeQueriesEmptyStateProps) {
  return (
    <div className="h-full w-full bg-background">
      <div className="flex w-full flex-col items-center px-4 py-16 text-center">
        <Boxes className="h-12 w-12" />
        <h3 className="mt-6 font-medium text-2xl tracking-tight">{title}</h3>
        <p className="mt-4 max-w-prose leading-7">{description}</p>
      </div>
    </div>
  );
}
