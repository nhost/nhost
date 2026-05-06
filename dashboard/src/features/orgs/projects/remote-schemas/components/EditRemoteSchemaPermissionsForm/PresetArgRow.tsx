import type { GraphQLArgument } from 'graphql';
import { memo, useEffect, useState } from 'react';
import { Input } from '@/components/ui/v3/input';

export interface PresetArgRowProps {
  schemaTypeName: string;
  fieldName: string;
  arg: GraphQLArgument;
  argTypeString: string;
  initialValue: string;
  onCommit: (
    schemaTypeName: string,
    fieldName: string,
    argName: string,
    value: string,
  ) => void;
}

const PresetArgRow = memo(
  ({
    schemaTypeName,
    fieldName,
    arg,
    argTypeString,
    initialValue,
    onCommit,
  }: PresetArgRowProps) => {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
      setValue(initialValue);
    }, [initialValue]);

    return (
      <div className="flex items-center space-x-2">
        <span className="min-w-0 flex-shrink-0 text-gray-600 text-sm">
          {arg.name}: {argTypeString}
        </span>
        <Input
          placeholder="preset value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            if (value !== initialValue) {
              onCommit(schemaTypeName, fieldName, arg.name, value);
            }
          }}
          className="text-xs"
        />
      </div>
    );
  },
);

export default PresetArgRow;
