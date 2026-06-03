import { ChevronDown, PencilIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { Button } from '@/components/ui/v3/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import type { PostgresFunction } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import { cn } from '@/lib/utils';
import type {
  ComputedFieldItem,
  QualifiedTable,
} from '@/utils/hasura-api/generated/schemas';
import ComputedFieldRowForm from './ComputedFieldRowForm';
import DeleteComputedFieldAlertDialog from './DeleteComputedFieldAlertDialog';

const DIRTY_SOURCE_PREFIX = 'edit-gql-computed-fields:row';

export interface ComputedFieldRowProps {
  field: ComputedFieldItem;
  table: QualifiedTable;
  source: string;
  functions: PostgresFunction[];
  schemas: string[];
  isFunctionsLoading?: boolean;
  isSchemasLoading?: boolean;
  disabled?: boolean;
  isExpanded: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ComputedFieldRow({
  field,
  table,
  source,
  functions,
  schemas,
  isFunctionsLoading,
  isSchemasLoading,
  disabled,
  isExpanded,
  onOpenChange,
}: ComputedFieldRowProps) {
  const { setDirtySource, openDirtyConfirmation } = useDialog();

  const [isFormDirty, setIsFormDirty] = useState(false);
  const handleFormDirtyChange = useCallback(
    (dirty: boolean) => setIsFormDirty(dirty),
    [],
  );

  const dirtySourceId = `${DIRTY_SOURCE_PREFIX}:${field.name}`;

  useEffect(() => {
    setDirtySource(dirtySourceId, isFormDirty);
    return () => {
      setDirtySource(dirtySourceId, false);
    };
  }, [dirtySourceId, isFormDirty, setDirtySource]);

  const requestClose = () => {
    if (isFormDirty) {
      openDirtyConfirmation({
        props: { onPrimaryAction: () => onOpenChange(false) },
      });
      return;
    }
    onOpenChange(false);
  };

  const functionLabel = `${field.definition.function.schema}.${field.definition.function.name}`;

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={(open) => (open ? onOpenChange(true) : requestClose())}
      disabled={disabled}
      className="overflow-hidden rounded-md"
    >
      <div
        className={cn(
          'grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_5.25rem] items-center gap-3 px-4 py-3',
          isExpanded ? 'bg-muted/40' : 'bg-background',
        )}
      >
        <TextWithTooltip
          text={field.name}
          className="font-mono text-foreground text-sm"
          containerClassName="cursor-text"
        />
        <TextWithTooltip
          text={functionLabel}
          className="font-mono text-muted-foreground text-sm"
          containerClassName="cursor-text"
        />
        <TextWithTooltip
          text={field.comment || '—'}
          className="text-muted-foreground text-sm"
          containerClassName="cursor-text"
        />
        <div className="flex items-center gap-1">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label={isExpanded ? 'Close editor' : 'Edit computed field'}
              data-testid={`edit-computed-field-${field.name}`}
            >
              {isExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <PencilIcon className="size-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <DeleteComputedFieldAlertDialog
            field={field}
            table={table}
            source={source}
            disabled={disabled}
          />
        </div>
      </div>
      <CollapsibleContent>
        <ComputedFieldRowForm
          field={field}
          table={table}
          source={source}
          functions={functions}
          schemas={schemas}
          isFunctionsLoading={isFunctionsLoading}
          isSchemasLoading={isSchemasLoading}
          disabled={disabled}
          onClose={() => onOpenChange(false)}
          onCancel={requestClose}
          onDirtyChange={handleFormDirtyChange}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
