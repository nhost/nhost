import { useDialog } from '@/components/common/DialogProvider';
import { Divider } from '@/components/ui/v2/Divider';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { IconButton } from '@/components/ui/v2/IconButton';
import { DotsHorizontalIcon } from '@/components/ui/v2/icons/DotsHorizontalIcon';
import { PencilIcon } from '@/components/ui/v2/icons/PencilIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type {
  RemoteSchemaInfoRemoteRelationshipsItem,
  RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem,
} from '@/utils/hasura-api/generated/schemas';
import { useDeleteRemoteSchemaRelationshipMutation } from '../../../hooks/useDeleteRemoteSchemaRelationshipMutation';
import {
  isToRemoteSchemaDefinition,
  isToSourceDefinition,
} from '../../../utils/guards';
import RelationshipTableCell from './RelationshipTableCell';

export interface RemoteSchemaRelationshipsInfoTableProps {
  sourceRemoteSchema: string;
  remoteRelationships: RemoteSchemaInfoRemoteRelationshipsItem[];
  onEditRelationship?: (
    relationship: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem,
  ) => void;
  onDeleteRelationship?: () => void;
}

export default function RemoteSchemaRelationshipsInfoTable({
  sourceRemoteSchema,
  remoteRelationships,
  onEditRelationship,
  onDeleteRelationship,
}: RemoteSchemaRelationshipsInfoTableProps) {
  const { openAlertDialog } = useDialog();

  console.log('remoteRelationships:', remoteRelationships);

  const getRelationshipType = (
    relationship: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem,
  ) => {
    if (isToRemoteSchemaDefinition(relationship.definition)) {
      return 'Remote Schema';
    }

    if (isToSourceDefinition(relationship.definition)) {
      return relationship.definition.to_source.relationship_type;
    }

    // Fallback, though this shouldn't happen with proper types
    return 'Unknown';
  };

  const getRelationshipTarget = (
    relationship: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem,
  ) => {
    if (isToRemoteSchemaDefinition(relationship.definition)) {
      return relationship.definition.to_remote_schema.remote_schema;
    }

    if (isToSourceDefinition(relationship.definition)) {
      return relationship.definition.to_source.source;
    }

    return 'Unknown';
  };
  // const {
  //   mutateAsync: createRemoteSchema,
  //   error: createRemoteSchemaError,
  //   reset: resetCreateRemoteSchemaError,
  // } = useCreateRemoteSchemaMutation();

  const { mutateAsync: deleteRemoteSchemaRelationship } =
    useDeleteRemoteSchemaRelationshipMutation();

  const handleDeleteRelationship = async (
    relationship: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem,
    typeName: string,
  ) => {
    await execPromiseWithErrorToast(
      async () => {
        await deleteRemoteSchemaRelationship({
          args: {
            name: relationship.name,
            remote_schema: sourceRemoteSchema,
            type_name: typeName,
          },
        });
        onDeleteRelationship?.();
      },
      {
        loadingMessage: 'Deleting relationship...',
        successMessage: 'Relationship deleted successfully.',
        errorMessage: 'Failed to delete relationship',
      },
    );
  };

  const handleDeleteRelationshipClick = (
    relationship: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem,
    typeName: string,
  ) => {
    openAlertDialog({
      title: 'Delete Relationship',
      payload: (
        <span>
          Are you sure you want to delete the{' '}
          <strong className="break-all">{relationship.name}</strong>{' '}
          relationship?
        </span>
      ),
      props: {
        primaryButtonText: 'Delete',
        primaryButtonColor: 'error',
        onPrimaryAction: () => handleDeleteRelationship(relationship, typeName),
      },
    });
  };

  const handleEditRelationshipClick = (
    relationship: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem,
  ) => {
    onEditRelationship?.(relationship);
  };

  return (
    <div className="px-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Name</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Relationship</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {remoteRelationships?.map((remoteRelationship) =>
            remoteRelationship.relationships.map((relationship) => (
              <TableRow key={relationship.name}>
                <TableCell className="font-medium">
                  {relationship.name}
                </TableCell>
                <TableCell>{getRelationshipTarget(relationship)}</TableCell>
                <TableCell>{getRelationshipType(relationship)}</TableCell>
                <TableCell>
                  <RelationshipTableCell relationship={relationship} />
                </TableCell>
                <TableCell>
                  <Dropdown.Root id={`relationship-menu-${relationship.name}`}>
                    <Dropdown.Trigger asChild hideChevron>
                      <IconButton variant="borderless" color="secondary">
                        <DotsHorizontalIcon />
                      </IconButton>
                    </Dropdown.Trigger>
                    <Dropdown.Content menu PaperProps={{ className: 'w-52' }}>
                      <Dropdown.Item
                        className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                        onClick={() =>
                          handleEditRelationshipClick(relationship)
                        }
                      >
                        <PencilIcon
                          className="h-4 w-4"
                          sx={{ color: 'text.secondary' }}
                        />
                        <span>Edit Relationship</span>
                      </Dropdown.Item>
                      <Divider component="li" />
                      <Dropdown.Item
                        className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                        sx={{ color: 'error.main' }}
                        onClick={() =>
                          handleDeleteRelationshipClick(
                            relationship,
                            remoteRelationship.type_name,
                          )
                        }
                      >
                        <TrashIcon
                          className="h-4 w-4"
                          sx={{ color: 'error.main' }}
                        />
                        <span>Delete Relationship</span>
                      </Dropdown.Item>
                    </Dropdown.Content>
                  </Dropdown.Root>
                </TableCell>
              </TableRow>
            )),
          )}
        </TableBody>
      </Table>
    </div>
  );
}
