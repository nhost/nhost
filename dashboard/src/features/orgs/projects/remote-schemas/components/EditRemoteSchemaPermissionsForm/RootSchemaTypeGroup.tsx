import type { GraphQLArgument } from 'graphql';
import { memo } from 'react';
import { Text } from '@/components/ui/v2/Text';
import { Accordion } from '@/components/ui/v3/accordion';
import type {
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

const RootSchemaTypeGroup = memo(
  ({
    schemaType,
    argTree,
    getArgTypeString,
    onFieldToggle,
    onPresetCommit,
  }: RootSchemaTypeGroupProps) => (
    <div className="space-y-2">
      <Text className="font-semibold text-blue-600">
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
              getArgTypeString={getArgTypeString}
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
