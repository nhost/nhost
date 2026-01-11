import { useDialog } from '@/components/common/DialogProvider';
import { Divider } from '@/components/ui/v2/Divider';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { IconButton } from '@/components/ui/v2/IconButton';
import { DotsHorizontalIcon } from '@/components/ui/v2/icons/DotsHorizontalIcon';
import { PencilIcon } from '@/components/ui/v2/icons/PencilIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Button } from '@/components/ui/v3/button';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import {
  isToRemoteSchemaRelationshipDefinition,
  isToSourceRelationshipDefinition,
} from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import { useDeleteRemoteSchemaRelationshipMutation } from '@/features/orgs/projects/remote-schemas/hooks/useDeleteRemoteSchemaRelationshipMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type {
  RemoteSchemaInfoRemoteRelationshipsItem,
  RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem,
} from '@/utils/hasura-api/generated/schemas';
import RelationshipTableCell from './RelationshipTableCell';

export interface RemoteSchemaRelationshipsInfoTableProps {
  sourceRemoteSchema: string;
  remoteRelationships: RemoteSchemaInfoRemoteRelationshipsItem[];
  onSelectRelationship?: (
    relationship: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem,
  ) => void;
  onDeleteRelationship?: () => void;
  onAddRelationship?: () => void;
  disabled?: boolean;
}

export default function RemoteSchemaRelationshipsInfoTable({
  sourceRemoteSchema,
  remoteRelationships,
  onSelectRelationship,
  onDeleteRelationship,
  onAddRelationship,
  disabled,
}: RemoteSchemaRelationshipsInfoTableProps) {
  const { openAlertDialog } = useDialog();

  const getRelationshipType = (
    relationship: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem,
  ) => {
    if (isToRemoteSchemaRelationshipDefinition(relationship.definition)) {
      return 'Remote Schema';
    }

    if (isToSourceRelationshipDefinition(relationship.definition)) {
      return relationship.definition.to_source.relationship_type;
    }

    return 'Unknown';
  };

  const getRelationshipTarget = (
    relationship: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem,
  ) => {
    if (isToRemoteSchemaRelationshipDefinition(relationship.definition)) {
      return relationship.definition.to_remote_schema.remote_schema;
    }

    if (isToSourceRelationshipDefinition(relationship.definition)) {
      return relationship.definition.to_source.source;
    }

    return 'Unknown';
  };

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
    onSelectRelationship?.(relationship);
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
        <TableFooter>
          <TableRow>
            <TableCell colSpan={5} className="px-0 py-2">
              <Button
                variant="link"
                className="hover:no-underline"
                color="secondary"
                onClick={onAddRelationship}
                disabled={disabled}
              >
                <PlusIcon />
                Add Relationship
              </Button>
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
