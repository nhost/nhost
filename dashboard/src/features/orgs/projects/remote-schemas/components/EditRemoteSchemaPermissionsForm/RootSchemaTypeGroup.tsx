import { memo } from 'react';
import { Text } from '@/components/ui/v2/Text';
import { Accordion } from '@/components/ui/v3/accordion';
import type {
  ArgLeafType,
  ArgTreeType,
  CustomFieldType,
  FieldType,
} from '@/features/orgs/projects/remote-schemas/types';
import RootFieldRow from './RootFieldRow';

export interface RootSchemaTypeGroupProps {
  schemaType: {
    name: string;
    children?: ReadonlyArray<FieldType | CustomFieldType>;
  };
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

const RootSchemaTypeGroup = memo(
  ({
    schemaType,
    argTree,
    sessionVariableOptions,
    onFieldToggle,
    onPresetCommit,
  }: RootSchemaTypeGroupProps) => (
    <div className="space-y-2">
      <Text className="font-semibold text-blue-600 dark:text-blue-400">
        {schemaType.name.replace('type ', '')} Operations
      </Text>
      <div className="pl-4">
        <Accordion type="multiple" className="space-y-1">
          {(schemaType.children ?? []).map((field) => (
            <RootFieldRow
              key={`${schemaType.name}.${field.name}`}
              schemaTypeName={schemaType.name}
              field={field}
              argTree={argTree}
              sessionVariableOptions={sessionVariableOptions}
              onFieldToggle={onFieldToggle}
              onPresetCommit={onPresetCommit}
            />
          ))}
        </Accordion>
      </div>
    </div>
  ),
);

export default RootSchemaTypeGroup;
