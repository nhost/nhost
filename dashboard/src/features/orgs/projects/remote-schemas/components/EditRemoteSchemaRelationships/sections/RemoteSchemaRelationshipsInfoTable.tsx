import {
  Ellipsis as DotsHorizontalIcon,
  SquarePen as PencilIcon,
  PlusIcon,
  Trash2 as TrashIcon,
} from 'lucide-react';
import { useDialog } from '@/components/common/DialogProvider';
import { IconButton } from '@/components/ui/v2/IconButton';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
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
}

export default function RemoteSchemaRelationshipsInfoTable({
  sourceRemoteSchema,
  remoteRelationships,
  onSelectRelationship,
  onDeleteRelationship,
  onAddRelationship,
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton variant="borderless" color="secondary">
                        <DotsHorizontalIcon />
                      </IconButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 p-0">
                      <DropdownMenuItem
                        className="flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                        onClick={() =>
                          handleEditRelationshipClick(relationship)
                        }
                      >
                        <PencilIcon className="h-4 w-4 text-muted-foreground" />
                        <span>Edit Relationship</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="!text-destructive flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                        onClick={() =>
                          handleDeleteRelationshipClick(
                            relationship,
                            remoteRelationship.type_name,
                          )
                        }
                      >
                        <TrashIcon className="h-4 w-4" />
                        <span>Delete Relationship</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
