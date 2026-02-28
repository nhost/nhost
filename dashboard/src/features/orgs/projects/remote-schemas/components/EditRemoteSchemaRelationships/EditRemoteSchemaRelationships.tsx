import { useState } from 'react';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { CreateRemoteSchemaRelationshipForm } from '@/features/orgs/projects/remote-schemas/components/CreateRemoteSchemaRelationshipForm';
import { EditRemoteSchemaRelationshipForm } from '@/features/orgs/projects/remote-schemas/components/EditRemoteSchemaRelationshipForm';
import { useGetRemoteSchemas } from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemas';
import type { DialogFormProps } from '@/types/common';
import type { RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem } from '@/utils/hasura-api/generated/schemas/remoteSchemaInfoRemoteRelationshipsItemRelationshipsItem';
import EmptyRemoteSchemaRelationships from './EmptyRemoteSchemaRelationships';
import RemoteSchemaRelationshipsInfoTable from './sections/RemoteSchemaRelationshipsInfoTable';

export interface EditRemoteSchemaRelationshipsProps extends DialogFormProps {
  /**
   * The schema name of the remote schema that is being edited.
   */
  schema: string;
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
  /**
   * Whether the form is disabled.
   */
  disabled?: boolean;
}

export default function EditRemoteSchemaRelationships({
  schema,
  onCancel,
  disabled,
}: EditRemoteSchemaRelationshipsProps) {
  const [view, setView] = useState<'list' | 'add' | 'edit' | 'view'>('list');

  const [selectedRelationship, setSelectedRelationship] =
    useState<RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem | null>(
      null,
    );

  const { data: remoteSchemas, status, refetch, error } = useGetRemoteSchemas();

  const remoteRelationships =
    remoteSchemas?.find((remoteSchema) => remoteSchema.name === schema)
      ?.remote_relationships || [];

  const typeName =
    remoteRelationships.find((remoteRelationship) =>
      remoteRelationship.relationships.some(
        (relationship) => relationship.name === selectedRelationship?.name,
      ),
    )?.type_name || '';

  const handleEditRelationship = (
    relationship: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem,
  ) => {
    setView('edit');
    setSelectedRelationship(relationship);
  };

  const handleViewRelationship = (
    relationship: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem,
  ) => {
    setView('view');
    setSelectedRelationship(relationship);
  };

  if (status === 'loading') {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading remote schema relationships..."
        className="justify-center"
      />
    );
  }

  if (status === 'error') {
    throw error instanceof Error
      ? error
      : new Error('Unknown error occurred. Please try again later.');
  }

  if (view === 'list') {
    if (
      remoteRelationships?.length > 0 &&
      remoteRelationships.some(
        (relationship) => relationship.relationships.length > 0,
      )
    ) {
      return (
        <RemoteSchemaRelationshipsInfoTable
          sourceRemoteSchema={schema}
          remoteRelationships={remoteRelationships}
          disabled={disabled}
          onAddRelationship={() => setView('add')}
          onSelectRelationship={
            disabled ? handleViewRelationship : handleEditRelationship
          }
          onDeleteRelationship={() => {
            refetch();
          }}
        />
      );
    }
    return (
      <EmptyRemoteSchemaRelationships
        disabled={disabled}
        onAddRelationship={() => setView('add')}
      />
    );
  }

  if (view === 'add') {
    return (
      <CreateRemoteSchemaRelationshipForm
        schema={schema}
        onCancel={() => {
          setView('list');
        }}
        onSubmit={() => {
          setView('list');
          refetch();
        }}
      />
    );
  }

  if ((view === 'edit' || view === 'view') && selectedRelationship) {
    return (
      <EditRemoteSchemaRelationshipForm
        schema={schema}
        relationship={selectedRelationship}
        typeName={typeName}
        onCancel={() => {
          setView('list');
          onCancel?.();
        }}
        onSubmit={() => {
          setView('list');
          refetch();
          onCancel?.();
        }}
        disabled={disabled}
        nameInputDisabled={view === 'edit'}
      />
    );
  }
}
