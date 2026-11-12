import { HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/v3/badge';
import highlightMatch from '@/features/orgs/utils/highlightMatch/highlightMatch';
import { cn } from '@/lib/utils';
import { getNodeLabel } from './schemaTreeItems';
import type { SchemaTreeNode } from './types';

export interface SchemaTreeItemTitleProps {
  node: SchemaTreeNode;
  highlightTerm?: string;
}

function isNestedMember(node: SchemaTreeNode) {
  return (
    (node.kind === 'field' && !node.isRootField) ||
    node.kind === 'inputField' ||
    node.kind === 'enumValue'
  );
}

export default function SchemaTreeItemTitle({
  node,
  highlightTerm,
}: SchemaTreeItemTitleProps) {
  const isNested = isNestedMember(node);

  return (
    <span
      className={cn('flex items-center gap-1', {
        'text-muted-foreground': isNested,
      })}
    >
      {isNested && <HelpCircle className="h-3 w-3 shrink-0" />}
      <span>
        {highlightMatch(getNodeLabel(node), highlightTerm?.trim() ?? '')}
      </span>
      {node.deprecationReason != null && (
        <Badge
          variant="outline"
          title={node.deprecationReason}
          className="px-1.5 py-0 font-normal text-[0.625rem]"
        >
          deprecated
        </Badge>
      )}
    </span>
  );
}
