import { memo } from 'react';
import { Text } from '@/components/ui/v2/Text';
import { Checkbox } from '@/components/ui/v3/checkbox';
import type {
  ArgLeafType,
  ArgTreeType,
  CustomFieldType,
  FieldType,
} from '@/features/orgs/projects/remote-schemas/types';
import PresetValueInput from './PresetValueInput';

export interface CustomFieldRowProps {
  schemaTypeName: string;
  field: FieldType | CustomFieldType;
  argTree: ArgTreeType;
  sessionVariableOptions: string[];
  onFieldToggle: (
    schemaTypeName: string,
    fieldName: string,
    checked: boolean,
  ) => void;
  onPresetCommit: (
    schemaTypeName: string,
    fieldName: string,
    argName: string,
    value: ArgLeafType | undefined,
  ) => void;
}

const CustomFieldRow = memo(
  ({
    schemaTypeName,
    field,
    argTree,
    sessionVariableOptions,
    onFieldToggle,
    onPresetCommit,
  }: CustomFieldRowProps) => {
    const fieldKey = `${schemaTypeName}.${field.name}`;
    const args = field.args ? Object.values(field.args) : [];
    const hasArgs = args.length > 0;

    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id={fieldKey}
            checked={field.checked}
            onCheckedChange={(checked) =>
              onFieldToggle(schemaTypeName, field.name, checked as boolean)
            }
          />
          <label htmlFor={fieldKey} className="flex-1 cursor-pointer">
            <span className="font-medium">{field.name}</span>
            {field.return && (
              <span className="ml-2 text-gray-500 text-sm">
                : {field.return}
              </span>
            )}
            {hasArgs && (
              <span className="ml-2 text-gray-400 text-xs">
                ({args.length} arg{args.length > 1 ? 's' : ''})
              </span>
            )}
          </label>
        </div>

        {field.expanded && hasArgs && (
          <div className="ml-6 space-y-2 border-gray-200 border-l-2 pl-4">
            <Text className="font-medium text-gray-700 text-sm">
              Arguments:
            </Text>
            {args.map((arg) => (
              <PresetValueInput
                key={arg.name}
                arg={arg}
                rawValue={argTree?.[schemaTypeName]?.[field.name]?.[arg.name]}
                sessionVariableOptions={sessionVariableOptions}
                onValueChange={(value) =>
                  onPresetCommit(schemaTypeName, field.name, arg.name, value)
                }
              />
            ))}
          </div>
        )}
      </div>
    );
  },
);

export default CustomFieldRow;
