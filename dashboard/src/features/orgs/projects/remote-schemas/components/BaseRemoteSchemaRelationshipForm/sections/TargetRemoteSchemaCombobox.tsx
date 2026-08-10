import { useFormContext } from 'react-hook-form';
import { FormCombobox } from '@/components/form/FormCombobox';
import type { RemoteSchemaInfo } from '@/utils/hasura-api/generated/schemas';
import type { RemoteSchemaRelationshipFormValues } from './RemoteSchemaRelationshipForm';

export interface TargetRemoteSchemaComboboxProps {
  remoteSchemas: RemoteSchemaInfo[];
}

export default function TargetRemoteSchemaCombobox({
  remoteSchemas,
}: TargetRemoteSchemaComboboxProps) {
  const form = useFormContext<RemoteSchemaRelationshipFormValues>();

  const options = remoteSchemas.map((schema) => ({
    label: schema.name,
    value: schema.name,
  }));

  return (
    <FormCombobox
      control={form.control}
      name="targetRemoteSchema"
      label="Target Remote Schema"
      placeholder="Select remote schema"
      searchPlaceholder="Search remote schema..."
      emptyText="No remote schema found."
      options={options}
    />
  );
}
