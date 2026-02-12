import type { HTMLAttributes } from 'react';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import GroupNodeRenderer from './GroupNodeRenderer';
import { RuleGroupEditorContext } from './useRuleGroupEditor';

export interface RuleGroupEditorProps extends HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
  schema: string;
  table: string;
  name: string;
  maxDepth?: number;
}

export default function RuleGroupEditor({
  disabled,
  schema,
  table,
  name,
  maxDepth,
  className,
  ...props
}: RuleGroupEditorProps) {
  const contextValue = useMemo(
    () => ({
      disabled: !!disabled,
      schema,
      table,
    }),
    [disabled, schema, table],
  );

  return (
    <RuleGroupEditorContext.Provider value={contextValue}>
      <div className={cn('text-primary-text', className)} {...props}>
        <GroupNodeRenderer name={name} maxDepth={maxDepth} />
      </div>
    </RuleGroupEditorContext.Provider>
  );
}
