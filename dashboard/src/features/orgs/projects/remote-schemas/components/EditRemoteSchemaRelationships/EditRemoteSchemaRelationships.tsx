import { useDialog } from '@/components/common/DialogProvider';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { DialogFormProps } from '@/types/common';
import { RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem } from '@/utils/hasura-api/generated/schemas/remoteSchemaInfoRemoteRelationshipsItemRelationshipsItem';
import { useState } from 'react';
import { useGetRemoteSchemasQuery } from '../../hooks/useGetRemoteSchemasQuery';
import { CreateRemoteSchemaRelationshipForm } from '../CreateRemoteSchemaRelationshipForm';
import { EditRemoteSchemaRelationshipForm } from '../EditRemoteSchemaRelationshipForm';
import EmptyRemoteSchemaRelationships from './EmptyRemoteSchemaRelationships';
import RemoteSchemaRelationshipsTable from './sections/RemoteSchemaRelationshipsTable';

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
  const { closeDrawerWithDirtyGuard } = useDialog();
  const { project } = useProject();
  const { org } = useCurrentOrg();

  // Tracks the current view shown in the form. If you click on the "Add Relationship" button, the view will be set to "add".
  const [view, setView] = useState<'list' | 'add' | 'edit'>('list');

  const [selectedEditRelationship, setSelectedEditRelationship] =
    useState<RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem | null>(
      null,
    );

  console.log('selectedEditRelationship', selectedEditRelationship);

  const {
    data: remoteSchemas,
    status,
    refetch,
    error,
  } = useGetRemoteSchemasQuery([`remote_schemas`, project?.subdomain]);

  const remoteRelationships =
    remoteSchemas?.find((remoteSchema) => remoteSchema.name === schema)
      ?.remote_relationships || [];

  const typeName =
    remoteRelationships.find((relationship) =>
      relationship.relationships.some(
        (relationship) => relationship.name === selectedEditRelationship?.name,
      ),
    )?.type_name || '';

  console.log('typeName', typeName);

  const handleEditRelationship = (
    relationship: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem,
  ) => {
    setView('edit');
    setSelectedEditRelationship(relationship);
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
    throw error || new Error('Unknown error occurred. Please try again later.');
  }

  if (view === 'list') {
    if (
      remoteRelationships?.length > 0 &&
      remoteRelationships.some(
        (relationship) => relationship.relationships.length > 0,
      )
    ) {
      return (
        <RemoteSchemaRelationshipsTable
          sourceRemoteSchema={schema}
          remoteRelationships={remoteRelationships}
          onEditRelationship={handleEditRelationship}
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

  if (view === 'edit') {
    return (
      <EditRemoteSchemaRelationshipForm
        schema={schema}
        relationship={selectedEditRelationship}
        typeName={typeName}
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
}
