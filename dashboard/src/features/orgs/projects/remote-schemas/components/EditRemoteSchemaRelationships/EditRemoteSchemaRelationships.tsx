import { useState } from 'react';
import { Spinner } from '@/components/ui/v3/spinner';
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
}

export default function EditRemoteSchemaRelationships({
  schema,
  onCancel,
}: EditRemoteSchemaRelationshipsProps) {
  const [view, setView] = useState<'list' | 'add' | 'edit'>('list');

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

  if (status === 'loading') {
    return (
      <Spinner size="xs" wrapperClassName="flex-row gap-1.5 justify-center">
        <span className="text-muted-foreground text-xs">
          Loading remote schema relationships...
        </span>
      </Spinner>
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
          onAddRelationship={() => setView('add')}
          onSelectRelationship={handleEditRelationship}
          onDeleteRelationship={() => {
            refetch();
          }}
        />
      );
    }
    return (
      <EmptyRemoteSchemaRelationships
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

  if (view === 'edit' && selectedRelationship) {
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
        nameInputDisabled
      />
    );
  }
}
