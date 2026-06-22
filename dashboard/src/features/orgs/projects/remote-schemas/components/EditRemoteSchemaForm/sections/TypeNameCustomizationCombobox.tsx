import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
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
    <Box>
      <Text className="font-medium">Type</Text>
      <Combobox
        options={options}
        value={fromType || null}
        placeholder="Select a type"
        searchPlaceholder="Search type..."
        emptyText="No type found."
        className="mt-1 w-full justify-between overflow-hidden text-left"
        onChange={(value) => changeTypeKey(fromType, value)}
      />
    </Box>
  );
}
