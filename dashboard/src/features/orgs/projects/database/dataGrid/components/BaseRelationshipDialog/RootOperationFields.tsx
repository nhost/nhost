import type { GraphQLSchema } from 'graphql';
import { Checkbox } from '@/components/ui/v3/checkbox';
import getTypeString from '@/features/orgs/projects/remote-schemas/utils/getTypeString';
import { isEmptyValue } from '@/lib/utils';

interface RootOperationFieldsProps {
  graphqlSchema: GraphQLSchema;
  selectedRootFieldPath: string;
  onRootFieldChange: (rootFieldPath: string | null) => void;
  disabled?: boolean;
}

export default function RootOperationFields({
  graphqlSchema,
  selectedRootFieldPath,
  onRootFieldChange,
  disabled,
}: RootOperationFieldsProps) {
  const queryRoot = graphqlSchema.getQueryType();
  if (isEmptyValue(queryRoot)) {
    return (
      <p className="text-muted-foreground text-sm">
        No Query type found in the remote schema.
      </p>
    );
  }

  const rootFields = Object.values(queryRoot!.getFields());
  if (rootFields.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No fields found in the Query type.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="font-semibold text-sm">Query</div>
      <div className="space-y-2">
        {rootFields.map((rootField) => {
          const rootFieldPath = rootField.name;
          const checked = selectedRootFieldPath === rootFieldPath;
          return (
            <div key={rootField.name} className="flex items-center gap-3">
              <Checkbox
                id={`root-query-${rootField.name}`}
                checked={checked}
                onCheckedChange={(nextChecked) => {
                  const shouldSelect = Boolean(nextChecked);
                  onRootFieldChange(shouldSelect ? rootFieldPath : null);
                }}
                disabled={disabled}
              />
              <label
                htmlFor={`root-query-${rootField.name}`}
                className="cursor-pointer text-sm"
              >
                <span className="font-medium">{rootField.name}</span>{' '}
                <span className="text-muted-foreground text-xs">
                  ({getTypeString(rootField.type)})
                </span>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
