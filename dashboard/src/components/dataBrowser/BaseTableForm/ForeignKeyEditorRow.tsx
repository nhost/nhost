import type { ForeignKeyRelation } from '@/types/dataBrowser';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import ArrowRightIcon from '@/ui/v2/icons/ArrowRightIcon';
import LinkIcon from '@/ui/v2/icons/LinkIcon';
import Text from '@/ui/v2/Text';
import { useWatch } from 'react-hook-form';

export interface ForeignKeyEditorRowProps {
  /**
   * Index of the current foreign key relation.
   */
  index: number;
  /**
   * Function to be called when the edit button is clicked.
   */
  onEdit: VoidFunction;
  /**
   * Function to be called when the delete button is clicked.
   */
  onDelete: VoidFunction;
}

export default function ForeignKeyEditorRow({
  index,
  onEdit,
  onDelete,
}: ForeignKeyEditorRowProps) {
  const foreignKeyRelation: ForeignKeyRelation = useWatch({
    name: `foreignKeyRelations.${index}`,
  });

  return (
    <Box className="grid grid-flow-col items-center justify-between gap-2 rounded-sm+ border-1 px-3 py-1">
      <div className="grid grid-flow-col items-center gap-2">
        <LinkIcon className="h-4 w-4" />

        <Text className="grid grid-flow-col items-center gap-1.5 truncate font-medium">
          <span className="truncate">{foreignKeyRelation.columnName}</span>{' '}
          <ArrowRightIcon />
          <span className="truncate">
            {foreignKeyRelation.referencedSchema}.
            {foreignKeyRelation.referencedTable}.
            {foreignKeyRelation.referencedColumn}
          </span>
        </Text>
      </div>

      <div className="grid grid-flow-col justify-start sm:justify-end">
        <Button
          onClick={onEdit}
          variant="borderless"
          className="min-w-[initial] py-1 px-2"
        >
          Edit
        </Button>

        <Button
          onClick={onDelete}
          variant="borderless"
          className="min-w-[initial] py-1 px-2"
        >
          Delete
        </Button>
      </div>
    </Box>
  );
}
