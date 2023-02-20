import { useDialog } from '@/components/common/DialogProvider';
import type { BaseForeignKeyFormValues } from '@/components/dataBrowser/BaseForeignKeyForm';
import type { DatabaseColumn } from '@/types/dataBrowser';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import ArrowRightIcon from '@/ui/v2/icons/ArrowRightIcon';
import LinkIcon from '@/ui/v2/icons/LinkIcon';
import InputLabel from '@/ui/v2/InputLabel';
import Text from '@/ui/v2/Text';
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
    const column = useWatch<Partial<DatabaseColumn>>();
    const { foreignKeyRelation } = column;

    if (!column.foreignKeyRelation) {
      return (
        <Button
          variant="borderless"
          className="py-1"
          disabled={!column.name || !column.type}
          ref={ref}
          onClick={() =>
            openDialog('CREATE_FOREIGN_KEY', {
              title: (
                <span className="grid grid-flow-row">
                  <span>Add a Foreign Key Relation</span>

                  <Text variant="subtitle1" component="span">
                    Foreign keys help ensure the referential integrity of your
                    data.
                  </Text>
                </span>
              ),
              payload: {
                selectedColumn: column.name,
                availableColumns: [column],
                onSubmit: (values: BaseForeignKeyFormValues) => {
                  setValue('foreignKeyRelation', values);
                  onCreateSubmit();
                },
              },
            })
          }
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
            onClick={() =>
              openDialog('EDIT_FOREIGN_KEY', {
                title: 'Edit Foreign Key Relation',
                payload: {
                  foreignKeyRelation,
                  availableColumns: [column],
                  selectedColumn: column.name,
                  onSubmit: (values: BaseForeignKeyFormValues) => {
                    setValue('foreignKeyRelation', values);
                    onEditSubmit();
                  },
                },
              })
            }
            variant="borderless"
            className="min-w-[initial] py-1 px-2"
          >
            Edit
          </Button>

          <Button
            onClick={() => setValue('foreignKeyRelation', null)}
            variant="borderless"
            className="min-w-[initial] py-1 px-2"
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
