import { Combobox } from '@/components/ui/v3/combobox';
import type { GraphQLTypeForVisualization } from '@/utils/hasura-api/generated/schemas';

interface TypeNameCustomizationComboboxProps {
  fromType: string;
  schemaTypes: GraphQLTypeForVisualization[];
  changeTypeKey: (fromType: string, toType: string) => void;
}

export default function TypeNameCustomizationCombobox({
  fromType,
  schemaTypes,
  changeTypeKey,
}: TypeNameCustomizationComboboxProps) {
  const options = schemaTypes.map((t) => ({
    label: t.name!,
    value: t.name!,
  }));

  return (
    <div>
      <p className="font-medium">Type</p>
      <Combobox
        options={options}
        value={fromType || null}
        placeholder="Select a type"
        searchPlaceholder="Search type..."
        emptyText="No type found."
        className="mt-1 w-full justify-between overflow-hidden text-left"
        onChange={(value) => changeTypeKey(fromType, value)}
      />
    </div>
  );
}
