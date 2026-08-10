import { Skeleton } from '@/components/ui/v3/skeleton';
import ComputedFieldsSectionShell from './ComputedFieldsSectionShell';

const SKELETON_KEYS = ['first', 'second'];

export default function ComputedFieldsSectionSkeleton() {
  return (
    <ComputedFieldsSectionShell>
      <div className="grid gap-2 px-4">
        {SKELETON_KEYS.map((key) => (
          <Skeleton key={`computed-field-skeleton-${key}`} className="h-12" />
        ))}
        <Skeleton className="h-10 border-dashed" />
      </div>
    </ComputedFieldsSectionShell>
  );
}
