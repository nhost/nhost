import { useEffect, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/v2/Alert';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { FormLabel } from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { Textarea } from '@/components/ui/v3/textarea';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import useGetRemoteSchemas from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemas/useGetRemoteSchemas';
import { isToRemoteSchemaRelationshipDefinition } from '@/features/orgs/projects/remote-schemas/utils/guards';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { cn } from '@/lib/utils';
import type {
  ExportMetadataResponseMetadataSourcesItemTablesItemRemoteRelationshipsItem,
  RemoteRelationshipDefinition,
} from '@/utils/hasura-api/generated/schemas';
import useUpdateRemoteRelationshipMutation from '../hooks/useUpdateRemoteRelationshipMutation/useUpdateRemoteRelationshipMutation';
import type { NormalizedQueryDataRow } from '../types/dataBrowser';

type MetadataRemoteRelationship =
  ExportMetadataResponseMetadataSourcesItemTablesItemRemoteRelationshipsItem & {
    name?: string;
    definition?: RemoteRelationshipDefinition;
  };

type RemoteFieldArgument = {
  id: string;
  name: string;
  type: 'column' | 'static';
  value: string;
};

type RemoteFieldNode = {
  id: string;
  name: string;
  arguments: RemoteFieldArgument[];
};

const createId = () => Math.random().toString(36).slice(2, 10);

const createEmptyNode = (): RemoteFieldNode => ({
  id: createId(),
  name: '',
  arguments: [],
});

const createArgument = (): RemoteFieldArgument => ({
  id: createId(),
  name: '',
  type: 'column',
  value: '',
});

const mapRemoteFieldToNodes = (
  remoteField?: Record<
    string,
    { arguments?: Record<string, unknown>; field?: Record<string, any> }
  >,
): RemoteFieldNode[] => {
  if (!remoteField || Object.keys(remoteField).length === 0) {
    return [createEmptyNode()];
  }

  const nodes: RemoteFieldNode[] = [];
  let currentField = remoteField;
  let depth = 0;

  while (currentField && Object.keys(currentField).length > 0) {
    const [fieldName] = Object.keys(currentField);
    if (!fieldName) {
      break;
    }

    const config = currentField[fieldName] ?? {};
    const node: RemoteFieldNode = {
      id: `${fieldName}-${depth}-${createId()}`,
      name: fieldName,
      arguments: Object.entries(config.arguments ?? {}).map(
        ([argumentName, argumentValue], index) => {
          const argumentAsString =
            typeof argumentValue === 'string'
              ? argumentValue
              : JSON.stringify(argumentValue);
          const isColumnReference =
            typeof argumentValue === 'string' && argumentValue.startsWith('$');
          return {
            id: `${argumentName}-${index}-${createId()}`,
            name: argumentName,
            type: isColumnReference ? 'column' : 'static',
            value: isColumnReference
              ? argumentAsString.slice(1)
              : argumentAsString.replace(/^"|"$/g, ''),
          };
        },
      ),
    };

    nodes.push(node);
    currentField = (config.field as Record<string, any>) ?? undefined;
    depth += 1;
  }

  return nodes.length > 0 ? nodes : [createEmptyNode()];
};

const inferStaticValue = (value: string) => {
  const trimmedValue = value.trim();
  if (trimmedValue === '') {
    return '';
  }

  if (trimmedValue === 'true') {
    return true;
  }

  if (trimmedValue === 'false') {
    return false;
  }

  if (!Number.isNaN(Number(trimmedValue)) && trimmedValue !== '') {
    return Number(trimmedValue);
  }

  try {
    return JSON.parse(trimmedValue);
  } catch {
    return trimmedValue;
  }
};

const buildRemoteFieldFromNodes = (nodes: RemoteFieldNode[]) => {
  const sanitizedNodes = nodes
    .map((node) => ({
      ...node,
      name: node.name.trim(),
      arguments: node.arguments
        .map((argument) => ({
          ...argument,
          name: argument.name.trim(),
          value: argument.value.trim(),
        }))
        .filter((argument) => argument.name.length > 0),
    }))
    .filter((node) => node.name.length > 0);

  if (sanitizedNodes.length === 0) {
    return null;
  }

  let currentField: Record<string, unknown> | undefined;

  for (let index = sanitizedNodes.length - 1; index >= 0; index -= 1) {
    const node = sanitizedNodes[index];
    const argumentEntries = node.arguments.reduce<Record<string, unknown>>(
      (accumulator, argument) => {
        if (argument.type === 'column' && argument.value.length > 0) {
          accumulator[argument.name] = `$${argument.value}`;
        } else if (argument.type === 'static' && argument.value.length > 0) {
          accumulator[argument.name] = inferStaticValue(argument.value);
        }

        return accumulator;
      },
      {},
    );

    currentField = {
      [node.name]: {
        ...(Object.keys(argumentEntries).length > 0
          ? { arguments: argumentEntries }
          : {}),
        ...(currentField ? { field: currentField } : {}),
      },
    };
  }

  return currentField ?? null;
};

const extractLhsFields = (nodes: RemoteFieldNode[]) => {
  const columns = new Set<string>();

  nodes.forEach((node) => {
    node.arguments.forEach((argument) => {
      if (argument.type === 'column' && argument.value.trim().length > 0) {
        columns.add(argument.value.trim());
      }
    });
  });

  return Array.from(columns);
};

export interface EditRemoteSchemaRelationshipDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  schema: string;
  tableName: string;
  source: string;
  relationship: MetadataRemoteRelationship | null;
  tableColumns: NormalizedQueryDataRow[];
  onSuccess?: () => Promise<void> | void;
}

export default function EditRemoteSchemaRelationshipDialog({
  open,
  setOpen,
  schema,
  tableName,
  source,
  relationship,
  tableColumns,
  onSuccess,
}: EditRemoteSchemaRelationshipDialogProps) {
  const [selectedRemoteSchema, setSelectedRemoteSchema] = useState('');
  const [nodes, setNodes] = useState<RemoteFieldNode[]>([createEmptyNode()]);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: remoteSchemas, status: remoteSchemasStatus } =
    useGetRemoteSchemas();

  const tableColumnOptions = useMemo(
    () =>
      tableColumns
        .map((column) => column?.column_name)
        .filter((columnName): columnName is string => Boolean(columnName)),
    [tableColumns],
  );

  const remoteFieldObject = useMemo(
    () => buildRemoteFieldFromNodes(nodes),
    [nodes],
  );

  const remoteFieldPreview = remoteFieldObject
    ? JSON.stringify(remoteFieldObject, null, 2)
    : '{}';

  const lhsFields = useMemo(() => extractLhsFields(nodes), [nodes]);

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const { mutateAsync: updateRemoteRelationship, isLoading: isSaving } =
    useUpdateRemoteRelationshipMutation();

  useEffect(() => {
    if (
      !open ||
      !relationship ||
      !relationship.definition ||
      !isToRemoteSchemaRelationshipDefinition(relationship.definition)
    ) {
      return;
    }

    const defaultRemoteSchema =
      relationship.definition.to_remote_schema.remote_schema ?? '';
    setSelectedRemoteSchema(defaultRemoteSchema);
    setNodes(
      mapRemoteFieldToNodes(
        relationship.definition.to_remote_schema.remote_field,
      ),
    );
    setFormError(null);
  }, [open, relationship]);

  const handleDialogChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setFormError(null);
    }

    setOpen(nextOpen);
  };

  const handleAddNode = () => {
    setNodes((previousNodes) => [...previousNodes, createEmptyNode()]);
  };

  const handleRemoveNode = (nodeId: string) => {
    setNodes((previousNodes) =>
      previousNodes.length === 1
        ? previousNodes
        : previousNodes.filter((node) => node.id !== nodeId),
    );
  };

  const handleNodeNameChange = (nodeId: string, name: string) => {
    setNodes((previousNodes) =>
      previousNodes.map((node) =>
        node.id === nodeId ? { ...node, name } : node,
      ),
    );
  };

  const handleAddArgument = (nodeId: string) => {
    setNodes((previousNodes) =>
      previousNodes.map((node) =>
        node.id === nodeId
          ? { ...node, arguments: [...node.arguments, createArgument()] }
          : node,
      ),
    );
  };

  const handleArgumentChange = (
    nodeId: string,
    argumentId: string,
    updates: Partial<RemoteFieldArgument>,
  ) => {
    setNodes((previousNodes) =>
      previousNodes.map((node) => {
        if (node.id !== nodeId) {
          return node;
        }

        return {
          ...node,
          arguments: node.arguments.map((argument) =>
            argument.id === argumentId ? { ...argument, ...updates } : argument,
          ),
        };
      }),
    );
  };

  const handleRemoveArgument = (nodeId: string, argumentId: string) => {
    setNodes((previousNodes) =>
      previousNodes.map((node) => {
        if (node.id !== nodeId) {
          return node;
        }

        return {
          ...node,
          arguments: node.arguments.filter(
            (argument) => argument.id !== argumentId,
          ),
        };
      }),
    );
  };

  const handleSave = async () => {
    if (
      !relationship ||
      !relationship.definition ||
      !isToRemoteSchemaRelationshipDefinition(relationship.definition)
    ) {
      return;
    }

    if (!resourceVersion) {
      setFormError(
        'Metadata is not ready yet. Please wait a moment and try again.',
      );
      return;
    }

    if (!selectedRemoteSchema) {
      setFormError('Please select a remote schema.');
      return;
    }

    if (!remoteFieldObject) {
      setFormError('Please provide at least one remote field.');
      return;
    }

    const args = {
      name: relationship.name ?? '',
      source,
      table: {
        schema,
        name: tableName,
      },
      definition: {
        to_remote_schema: {
          remote_schema: selectedRemoteSchema,
          lhs_fields: lhsFields,
          remote_field: remoteFieldObject,
        },
      },
    };

    await execPromiseWithErrorToast(
      async () => {
        await updateRemoteRelationship({
          resourceVersion,
          args,
        });
        setOpen(false);
        await onSuccess?.();
      },
      {
        loadingMessage: 'Saving relationship...',
        successMessage: 'Relationship updated successfully.',
        errorMessage: 'Failed to update remote relationship.',
      },
    );
  };

  const isRemoteSchemaDefinition =
    relationship &&
    relationship.definition &&
    isToRemoteSchemaRelationshipDefinition(relationship.definition);

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Remote Schema Relationship</DialogTitle>
        </DialogHeader>

        {!isRemoteSchemaDefinition ? (
          <Alert severity="error">
            Unable to load this relationship. Please try again later.
          </Alert>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="space-y-2">
              <FormLabel>Remote schema</FormLabel>
              <Select
                value={selectedRemoteSchema}
                onValueChange={(value) => {
                  setSelectedRemoteSchema(value);
                }}
                disabled={remoteSchemasStatus === 'loading' || isSaving}
              >
                <SelectTrigger
                  className={cn({
                    'border-destructive': formError && !selectedRemoteSchema,
                  })}
                >
                  <SelectValue placeholder="Select remote schema" />
                </SelectTrigger>
                <SelectContent>
                  {remoteSchemas?.map((remoteSchema) => (
                    <SelectItem
                      key={remoteSchema.name}
                      value={remoteSchema.name}
                    >
                      {remoteSchema.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-medium">Remote field path</h3>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddNode}
                  disabled={isSaving}
                >
                  Add nested field
                </Button>
              </div>

              <div className="space-y-4">
                {nodes.map((node, index) => (
                  <div
                    key={node.id}
                    className="space-y-3 rounded-md border border-border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <FormLabel className="flex-1">
                        Field {index + 1}
                        <Input
                          value={node.name}
                          onChange={(event) =>
                            handleNodeNameChange(node.id, event.target.value)
                          }
                          placeholder="Enter field name"
                          disabled={isSaving}
                          className="mt-1"
                        />
                      </FormLabel>

                      {nodes.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => handleRemoveNode(node.id)}
                          disabled={isSaving}
                        >
                          Remove
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Arguments</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddArgument(node.id)}
                          disabled={isSaving}
                        >
                          Add argument
                        </Button>
                      </div>

                      {node.arguments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No arguments configured.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {node.arguments.map((argument) => (
                            <div
                              key={argument.id}
                              className="grid grid-cols-12 gap-3"
                            >
                              <div className="col-span-3">
                                <FormLabel>
                                  Argument name
                                  <Input
                                    value={argument.name}
                                    onChange={(event) =>
                                      handleArgumentChange(
                                        node.id,
                                        argument.id,
                                        {
                                          name: event.target.value,
                                        },
                                      )
                                    }
                                    placeholder="e.g. after"
                                    disabled={isSaving}
                                    className="mt-1"
                                  />
                                </FormLabel>
                              </div>

                              <div className="col-span-3">
                                <FormLabel>
                                  Value type
                                  <Select
                                    value={argument.type}
                                    onValueChange={(
                                      value: 'column' | 'static',
                                    ) =>
                                      handleArgumentChange(
                                        node.id,
                                        argument.id,
                                        {
                                          type: value,
                                          value:
                                            value === 'column'
                                              ? (tableColumnOptions[0] ?? '')
                                              : '',
                                        },
                                      )
                                    }
                                    disabled={isSaving}
                                  >
                                    <SelectTrigger className="mt-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="column">
                                        Table column
                                      </SelectItem>
                                      <SelectItem value="static">
                                        Static value
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormLabel>
                              </div>

                              <div className="col-span-5">
                                {argument.type === 'column' ? (
                                  <FormLabel>
                                    Column
                                    <Select
                                      value={argument.value}
                                      onValueChange={(value) =>
                                        handleArgumentChange(
                                          node.id,
                                          argument.id,
                                          {
                                            value,
                                          },
                                        )
                                      }
                                      disabled={
                                        isSaving ||
                                        tableColumnOptions.length === 0
                                      }
                                    >
                                      <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Select column" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {tableColumnOptions.length === 0 ? (
                                          <SelectItem value="" disabled>
                                            No columns available
                                          </SelectItem>
                                        ) : (
                                          tableColumnOptions.map(
                                            (columnName) => (
                                              <SelectItem
                                                key={columnName}
                                                value={columnName}
                                              >
                                                {columnName}
                                              </SelectItem>
                                            ),
                                          )
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </FormLabel>
                                ) : (
                                  <FormLabel>
                                    Static value
                                    <Input
                                      value={argument.value}
                                      onChange={(event) =>
                                        handleArgumentChange(
                                          node.id,
                                          argument.id,
                                          {
                                            value: event.target.value,
                                          },
                                        )
                                      }
                                      placeholder='e.g. "100"'
                                      disabled={isSaving}
                                      className="mt-1"
                                    />
                                  </FormLabel>
                                )}
                              </div>

                              <div className="col-span-1 flex items-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() =>
                                    handleRemoveArgument(node.id, argument.id)
                                  }
                                  disabled={isSaving}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <FormLabel>Remote field JSON</FormLabel>
              <Textarea
                value={remoteFieldPreview}
                readOnly
                className="font-mono text-xs"
                rows={8}
              />
              <p className="text-sm text-muted-foreground">
                This is the value that will be sent as{' '}
                <code className="rounded bg-muted px-1 py-0.5">
                  remote_field
                </code>
                .
              </p>
            </div>

            <div>
              <FormLabel>Referenced columns</FormLabel>
              {lhsFields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Columns will be added automatically as you map arguments to
                  table columns.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {lhsFields.map((column) => (
                    <span
                      key={column}
                      className="rounded-full bg-muted px-3 py-1 text-sm"
                    >
                      {column}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={isSaving}>
                Save Changes
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
