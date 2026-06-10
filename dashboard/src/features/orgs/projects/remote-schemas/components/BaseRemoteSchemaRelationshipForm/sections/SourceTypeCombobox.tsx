import { useFormContext } from 'react-hook-form';
import { FormCombobox } from '@/components/form/FormCombobox';
import type { DatabaseRelationshipFormValues } from './DatabaseRelationshipForm';
import type { RemoteSchemaRelationshipFormValues } from './RemoteSchemaRelationshipForm';

export interface SourceTypeComboboxProps {
  sourceTypes: { label: string; value: string }[];
}

export default function SourceTypeCombobox({
  sourceTypes,
}: SourceTypeComboboxProps) {
  const form = useFormContext<
    DatabaseRelationshipFormValues | RemoteSchemaRelationshipFormValues
  >();

  return (
    <FormCombobox
      control={form.control}
      name="sourceType"
      label="Source Type"
      placeholder="Select type"
      searchPlaceholder="Search source type..."
      emptyText="No source type found."
      options={sourceTypes}
    />
  );
}
