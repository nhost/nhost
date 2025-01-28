import { useDialog } from '@/components/common/DialogProvider';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { ArrowRightIcon } from '@/components/ui/v2/icons/ArrowRightIcon';
import { LinkIcon } from '@/components/ui/v2/icons/LinkIcon';
import { InputLabel } from '@/components/ui/v2/InputLabel';
import { Text } from '@/components/ui/v2/Text';
import { CreateForeignKeyForm } from '@/features/database/dataGrid/components/CreateForeignKeyForm';
import { EditForeignKeyForm } from '@/features/database/dataGrid/components/EditForeignKeyForm';
import type { DatabaseColumn } from '@/features/database/dataGrid/types/dataBrowser';
import type { ForwardedRef } from 'react';
import { forwardRef, useRef } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

interface ForeignKeyEditorInputProps {
  /**
   * Function to be called when the user finishes creating a foreign key.
   */
  onCreateSubmit: VoidFunction;
  /**
   * Function to be called when the user finishes editing a foreign key.
   */
  onEditSubmit: VoidFunction;
}

const ForeignKeyEditorInput = forwardRef(
  (
    { onCreateSubmit, onEditSubmit }: ForeignKeyEditorInputProps,
    ref: ForwardedRef<HTMLButtonElement>,
  ) => {
    const { openDialog } = useDialog();
    const { setValue } = useFormContext();
    const column = useWatch() as DatabaseColumn;
    const { foreignKeyRelation } = column;

    if (!column.foreignKeyRelation) {
      return (
        <Button
          variant="borderless"
          className="py-1"
          disabled={!column.name || !column.type}
          ref={ref}
          onClick={() => {
            openDialog({
              title: (
                <span className="grid grid-flow-row">
                  <span>Add a Foreign Key Relation</span>

                  <Text variant="subtitle1" component="span">
                    Foreign keys help ensure the referential integrity of your
                    data.
                  </Text>
                </span>
              ),
              component: (
                <CreateForeignKeyForm
                  selectedColumn={column.name}
                  availableColumns={[column]}
                  onSubmit={(values) => {
                    setValue('foreignKeyRelation', values);
                    onCreateSubmit();
                  }}
                />
              ),
            });
          }}
        >
          Add Foreign Key
        </Button>
      );
    }

    return (
      <div className="grid grid-flow-col items-center justify-between justify-items-start gap-2 rounded-sm+ px-2">
        <div className="grid grid-flow-col items-center gap-2">
          <LinkIcon className="h-4 w-4" />

          <Text className="grid grid-flow-col items-center gap-1.5 truncate font-medium">
            <span className="truncate">{foreignKeyRelation.columnName}</span>
            <ArrowRightIcon />
            <span className="truncate">
              {foreignKeyRelation.referencedSchema}.
              {foreignKeyRelation.referencedTable}.
              {foreignKeyRelation.referencedColumn}
            </span>
          </Text>
        </div>

        <div className="grid grid-flow-col">
          <Button
            ref={ref}
            onClick={() => {
              openDialog({
                title: 'Edit Foreign Key Relation',
                component: (
                  <EditForeignKeyForm
                    foreignKeyRelation={foreignKeyRelation}
                    selectedColumn={column.name}
                    availableColumns={[column]}
                    onSubmit={(values) => {
                      setValue('foreignKeyRelation', values);
                      onEditSubmit();
                    }}
                  />
                ),
              });
            }}
            variant="borderless"
            className="min-w-[initial] px-2 py-1"
          >
            Edit
          </Button>

          <Button
            onClick={() => setValue('foreignKeyRelation', null)}
            variant="borderless"
            className="min-w-[initial] px-2 py-1"
          >
            Delete
          </Button>
        </div>
      </div>
    );
  },
);

ForeignKeyEditorInput.displayName = 'NhostForeignKeyEditorInput';

export default function ForeignKeyEditor() {
  const buttonRef = useRef<HTMLButtonElement>();

  return (
    <div className="col-span-8 grid grid-cols-8 items-center justify-start gap-x-4 gap-y-2">
      <InputLabel className="col-span-8 sm:col-span-2">Foreign Key</InputLabel>

      <Box className="col-span-8 rounded-sm+ border-1 px-1 py-[3px] sm:col-span-6">
        <ForeignKeyEditorInput
          ref={buttonRef}
          onEditSubmit={() =>
            requestAnimationFrame(() => buttonRef.current.focus())
          }
          onCreateSubmit={() =>
            requestAnimationFrame(() => buttonRef.current.focus())
          }
        />
      </Box>
    </div>
  );
}
