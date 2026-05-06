import type { GraphQLArgument } from 'graphql';
import { memo } from 'react';
import { Text } from '@/components/ui/v2/Text';
import type {
  ArgTreeType,
  CustomFieldType,
  FieldType,
} from '@/features/orgs/projects/remote-schemas/types';
import CustomFieldRow from './CustomFieldRow';

export interface CustomSchemaTypeGroupProps {
  schemaType: {
    name: string;
    children?: ReadonlyArray<FieldType | CustomFieldType>;
  };
  argTree: ArgTreeType;
  getArgTypeString: (arg: GraphQLArgument) => string;
  onFieldToggle: (
    schemaTypeName: string,
    fieldName: string,
    checked: boolean,
  ) => void;
  onPresetCommit: (
    schemaTypeName: string,
    fieldName: string,
    argName: string,
    value: string,
  ) => void;
}

const CustomSchemaTypeGroup = memo(
  ({
    schemaType,
    argTree,
    getArgTypeString,
    onFieldToggle,
    onPresetCommit,
  }: CustomSchemaTypeGroupProps) => (
    <div className="space-y-2">
      <Text className="font-semibold text-green-600 dark:text-green-400">
        {schemaType.name}
      </Text>
      <div className="space-y-1 pl-4">
        {(schemaType.children ?? []).map((field) => (
          <CustomFieldRow
            key={`${schemaType.name}.${field.name}`}
            schemaTypeName={schemaType.name}
            field={field}
            argTree={argTree}
            getArgTypeString={getArgTypeString}
            onFieldToggle={onFieldToggle}
            onPresetCommit={onPresetCommit}
          />
        ))}
      </div>
    </div>
  ),
);

export default CustomSchemaTypeGroup;
