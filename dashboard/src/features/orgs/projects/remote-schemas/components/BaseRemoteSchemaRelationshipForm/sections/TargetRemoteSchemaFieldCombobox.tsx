import { useFormContext } from 'react-hook-form';
import { FormCombobox } from '@/components/form/FormCombobox';
import type { RemoteSchemaRelationshipFormValues } from './RemoteSchemaRelationshipForm';

export interface TargetRemoteSchemaFieldComboboxProps {
  targetFields: { label: string; value: string }[];
}

export default function TargetRemoteSchemaFieldCombobox({
  targetFields,
}: TargetRemoteSchemaFieldComboboxProps) {
  const form = useFormContext<RemoteSchemaRelationshipFormValues>();

  return (
    <FormCombobox
      control={form.control}
      name="targetField"
      label="Target Remote Schema Field"
      placeholder="Select field"
      searchPlaceholder="Search target field..."
      emptyText="No target field found."
      options={targetFields}
    />
  );
}
