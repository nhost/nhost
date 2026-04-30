import { Trash2 } from 'lucide-react';
import { useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import type { InvalidNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';

interface InvalidNodeRendererProps {
  name: string;
  onRemove?: VoidFunction;
}

export default function InvalidNodeRenderer({
  name,
  onRemove,
}: InvalidNodeRendererProps) {
  const node = useWatch({ name }) as InvalidNode | undefined;
  const label = node?.key ?? '';

  return (
    <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/60 bg-destructive/5 px-3 py-2 text-destructive text-sm">
      <span className="flex-1 font-mono">Invalid rule: {label}</span>
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive"
          onClick={onRemove}
          aria-label="Delete invalid rule"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
