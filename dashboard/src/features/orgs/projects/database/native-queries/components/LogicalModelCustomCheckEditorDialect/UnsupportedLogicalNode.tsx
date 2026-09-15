import { Button } from '@/components/ui/v3/button';
import type { NodeRendererProps } from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/useCustomCheckEditor';

export default function UnsupportedLogicalNode({
  onRemove,
}: NodeRendererProps) {
  return (
    <div className="flex items-center justify-between rounded-md border border-destructive p-2 text-destructive text-sm">
      Unsupported logical-model node
      {onRemove ? (
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
      ) : null}
    </div>
  );
}
