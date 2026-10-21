import { memo } from 'react';
import { Checkbox } from './Checkbox';
import ColumnComment from './ColumnComment';
import DefaultValueInput from './DefaultValueInput';
import { NameInput } from './NameInput';
import { RemoveButton } from './RemoveButton';
import { TypeCombobox } from './TypeCombobox';

export interface FieldArrayInputProps {
  /**
   * Index of the field in the field array.
   */
  index: number;
}

export interface ColumnEditorRowProps extends FieldArrayInputProps {
  /**
   * Function to be called when the user wants to remove a row.
   */
  remove: (index: number) => void;
}

const ColumnEditorRow = memo(({ index, remove }: ColumnEditorRowProps) => (
  <div className="flex w-full items-start gap-2">
    <div className="w-52 flex-none">
      <NameInput index={index} />
    </div>

    <div className="w-52 flex-none">
      <TypeCombobox index={index} />
    </div>

    <div className="w-52 flex-none">
      <DefaultValueInput index={index} />
    </div>

    <div className="flex h-11 w-8 flex-none items-center justify-center md:h-9">
      <ColumnComment index={index} />
    </div>

    <div className="flex h-11 w-13 flex-none items-center justify-center md:h-9">
      <Checkbox
        name={`columns.${index}.isNullable`}
        aria-label="Nullable"
        index={index}
        data-testid={`columns.${index}.isNullable`}
      />
    </div>

    <div className="flex h-11 w-13 flex-none items-center justify-center md:h-9">
      <Checkbox
        name={`columns.${index}.isUnique`}
        aria-label="Unique"
        index={index}
        data-testid={`columns.${index}.isUnique`}
      />
    </div>

    <div className="flex h-11 w-9 flex-none items-center justify-center md:h-9">
      <RemoveButton
        index={index}
        onClick={() => {
          remove(index);
        }}
      />
    </div>
  </div>
));

ColumnEditorRow.displayName = 'NhostColumnEditorRow';

export default ColumnEditorRow;
