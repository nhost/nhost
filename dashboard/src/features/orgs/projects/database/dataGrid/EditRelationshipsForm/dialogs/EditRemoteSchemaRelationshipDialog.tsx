import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

import { Alert } from '@/components/ui/v2/Alert';
import { Button } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { Input } from '@/components/ui/v3/input';
import { Label } from '@/components/ui/v3/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { Textarea } from '@/components/ui/v3/textarea';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useCreateRemoteRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateRemoteRelationshipMutation';
import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { isToRemoteSchemaRelationshipDefinition } from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import useGetRemoteSchemas from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemas/useGetRemoteSchemas';
import { useIntrospectRemoteSchemaQuery } from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery';
import convertIntrospectionToSchema from '@/features/orgs/projects/remote-schemas/utils/convertIntrospectionToSchema';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { cn } from '@/lib/utils';
import type {
  RemoteRelationshipDefinition,
  RemoteRelationshipItem,
} from '@/utils/hasura-api/generated/schemas';
import {
  isListType,
  isNonNullType,
  isObjectType,
  type GraphQLField,
  type GraphQLObjectType,
  type GraphQLSchema,
} from 'graphql';
import { SquarePen } from 'lucide-react';

type MetadataRemoteRelationship = RemoteRelationshipItem & {
  name?: string;
  definition?: RemoteRelationshipDefinition;
};

type RemoteFieldArgumentMapping = {
  enabled: boolean;
  type: 'column' | 'static';
  value: string;
};

type RemoteFieldArgumentMappingsByPath = Record<
  string,
  Record<string, RemoteFieldArgumentMapping>
>;

const serializeRemoteFieldArgumentValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null) {
    return 'null';
  }

  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
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

const getOperationRoots = (graphqlSchema: GraphQLSchema) => {
  const roots: Array<{
    label: string;
    value: 'query' | 'mutation' | 'subscription';
    type: GraphQLObjectType;
  }> = [];

  const queryType = graphqlSchema.getQueryType();
  if (queryType) {
    roots.push({ label: 'Query', value: 'query', type: queryType });
  }

  const mutationType = graphqlSchema.getMutationType();
  if (mutationType) {
    roots.push({ label: 'Mutation', value: 'mutation', type: mutationType });
  }

  const subscriptionType = graphqlSchema.getSubscriptionType();
  if (subscriptionType) {
    roots.push({
      label: 'Subscription',
      value: 'subscription',
      type: subscriptionType,
    });
  }

  return roots;
};

const unwrapNamedType = (type: any) => {
  let current = type;
  while (current && typeof current === 'object' && 'ofType' in current) {
    current = (current as any).ofType;
  }
  return current as any;
};

const getTypeString = (type: any): string => {
  if (isNonNullType(type)) {
    return `${getTypeString(type.ofType)}!`;
  }
  if (isListType(type)) {
    return `[${getTypeString(type.ofType)}]`;
  }
  return type?.name ?? '';
};

const parseRemoteFieldToSelection = (
  remoteField?: Record<
    string,
    { arguments?: Record<string, unknown>; field?: Record<string, any> }
  >,
) => {
  const selectedFieldPaths = new Set<string>();
  const argumentMappingsByPath: RemoteFieldArgumentMappingsByPath = {};

  if (!remoteField || Object.keys(remoteField).length === 0) {
    return {
      rootFieldPath: '',
      selectedFieldPaths,
      argumentMappingsByPath,
    };
  }

  const [rootFieldName] = Object.keys(remoteField);
  if (!rootFieldName) {
    return {
      rootFieldPath: '',
      selectedFieldPaths,
      argumentMappingsByPath,
    };
  }

  const walk = (
    fieldMap: Record<
      string,
      { arguments?: Record<string, unknown>; field?: Record<string, any> }
    >,
    parentPath: string | null,
  ) => {
    Object.entries(fieldMap).forEach(([fieldName, config]) => {
      const currentPath = parentPath ? `${parentPath}.${fieldName}` : fieldName;
      selectedFieldPaths.add(currentPath);

      const args = config?.arguments ?? {};
      const argEntries = Object.entries(args);
      if (argEntries.length > 0) {
        argumentMappingsByPath[currentPath] = argEntries.reduce<
          Record<string, RemoteFieldArgumentMapping>
        >((accumulator, [argumentName, argumentValue]) => {
          const isColumnReference =
            typeof argumentValue === 'string' && argumentValue.startsWith('$');

          accumulator[argumentName] = {
            enabled: true,
            type: isColumnReference ? 'column' : 'static',
            value: isColumnReference
              ? argumentValue.slice(1)
              : serializeRemoteFieldArgumentValue(argumentValue),
          };

          return accumulator;
        }, {});
      }

      if (config?.field && Object.keys(config.field).length > 0) {
        walk(config.field, currentPath);
      }
    });
  };

  walk(remoteField, null);

  return {
    rootFieldPath: rootFieldName,
    selectedFieldPaths,
    argumentMappingsByPath,
  };
};

const extractLhsFieldsFromMappings = (
  argumentMappingsByPath: RemoteFieldArgumentMappingsByPath,
) => {
  const columns = new Set<string>();
  Object.values(argumentMappingsByPath).forEach((mappingsByArgument) => {
    Object.values(mappingsByArgument).forEach((mapping) => {
      if (
        mapping.enabled &&
        mapping.type === 'column' &&
        mapping.value.trim().length > 0
      ) {
        columns.add(mapping.value.trim());
      }
    });
  });

  return Array.from(columns);
};

const buildRemoteFieldFromSelection = (
  selectedFieldPaths: Set<string>,
  argumentMappingsByPath: RemoteFieldArgumentMappingsByPath,
) => {
  const rootCandidates = Array.from(selectedFieldPaths).filter(
    (path) => !path.includes('.'),
  );
  const rootFieldName = rootCandidates[0];
  if (!rootFieldName) {
    return null;
  }

  const getImmediateChildren = (parentPath: string) => {
    const prefix = `${parentPath}.`;
    const children = new Set<string>();

    selectedFieldPaths.forEach((path) => {
      if (!path.startsWith(prefix)) {
        return;
      }

      const rest = path.slice(prefix.length);
      const [childName] = rest.split('.');
      if (childName) {
        children.add(childName);
      }
    });

    return Array.from(children);
  };

  const buildNode = (fieldPath: string): Record<string, unknown> => {
    const mappingsByArgument = argumentMappingsByPath[fieldPath] ?? {};
    const argumentEntries = Object.entries(mappingsByArgument).reduce<
      Record<string, unknown>
    >((accumulator, [argumentName, mapping]) => {
      if (!mapping.enabled) {
        return accumulator;
      }

      if (mapping.type === 'column' && mapping.value.trim().length > 0) {
        accumulator[argumentName] = `$${mapping.value.trim()}`;
      } else if (mapping.type === 'static' && mapping.value.trim().length > 0) {
        accumulator[argumentName] = inferStaticValue(mapping.value.trim());
      }

      return accumulator;
    }, {});

    const children = getImmediateChildren(fieldPath);
    const fieldEntries = children.reduce<Record<string, unknown>>(
      (accumulator, childName) => {
        const childPath = `${fieldPath}.${childName}`;
        accumulator[childName] = buildNode(childPath);
        return accumulator;
      },
      {},
    );

    return {
      arguments: argumentEntries,
      ...(Object.keys(fieldEntries).length > 0 ? { field: fieldEntries } : {}),
    };
  };

  return {
    [rootFieldName]: buildNode(rootFieldName),
  };
};

type RemoteSchemaFieldNodeProps = {
  schema: GraphQLSchema;
  field: GraphQLField<any, any>;
  fieldPath: string;
  selectedFieldPaths: Set<string>;
  setSelectedFieldPaths: Dispatch<SetStateAction<Set<string>>>;
  argumentMappingsByPath: RemoteFieldArgumentMappingsByPath;
  setArgumentMappingsByPath: Dispatch<
    SetStateAction<RemoteFieldArgumentMappingsByPath>
  >;
  tableColumnOptions: string[];
  disabled?: boolean;
  depth?: number;
  maxDepth?: number;
  ancestorTypeNames?: Set<string>;
};

function RemoteSchemaFieldNode({
  schema,
  field,
  fieldPath,
  selectedFieldPaths,
  setSelectedFieldPaths,
  argumentMappingsByPath,
  setArgumentMappingsByPath,
  tableColumnOptions,
  disabled,
  depth = 0,
  maxDepth = 6,
  ancestorTypeNames = new Set<string>(),
}: RemoteSchemaFieldNodeProps) {
  const isSelected = selectedFieldPaths.has(fieldPath);
  const fieldTypeString = getTypeString(field.type);
  const namedType = unwrapNamedType(field.type);

  const canRecurse =
    isObjectType(namedType) &&
    depth < maxDepth &&
    !ancestorTypeNames.has(namedType.name);

  const childFields = useMemo(() => {
    if (!canRecurse) {
      return [];
    }

    const objectType = schema.getType(namedType.name);
    if (!isObjectType(objectType)) {
      return [];
    }

    const fieldsMap = objectType.getFields();
    return Object.values(fieldsMap);
  }, [canRecurse, namedType, schema]);

  const mappingsByArgument = argumentMappingsByPath[fieldPath] ?? {};
  const defaultMapping: RemoteFieldArgumentMapping = {
    enabled: false,
    type: 'column',
    value: tableColumnOptions[0] ?? '',
  };

  const setSelected = (checked: boolean) => {
    setSelectedFieldPaths((previous) => {
      const next = new Set(previous);
      if (checked) {
        // Ensure ancestors are selected.
        const parts = fieldPath.split('.');
        for (let i = 1; i <= parts.length; i += 1) {
          next.add(parts.slice(0, i).join('.'));
        }
      } else {
        // Remove this node and all its descendants.
        Array.from(next).forEach((path) => {
          if (path === fieldPath || path.startsWith(`${fieldPath}.`)) {
            next.delete(path);
          }
        });
        // Clear argument mappings for removed nodes.
        setArgumentMappingsByPath((previousMappings) => {
          const cleaned = { ...previousMappings };
          Object.keys(cleaned).forEach((path) => {
            if (path === fieldPath || path.startsWith(`${fieldPath}.`)) {
              delete cleaned[path];
            }
          });
          return cleaned;
        });
      }
      return next;
    });
  };

  return (
    <div className="space-y-2">
      <div
        className={cn('flex items-start gap-3', {
          'opacity-60': disabled,
        })}
        style={{ paddingLeft: depth * 12 }}
      >
        <Checkbox
          id={`remote-field-${fieldPath}`}
          checked={isSelected}
          onCheckedChange={(checked) => setSelected(Boolean(checked))}
          disabled={disabled}
        />
        <label
          htmlFor={`remote-field-${fieldPath}`}
          className="cursor-pointer text-sm"
        >
          <span className="font-medium">{field.name}</span>{' '}
          <span className="text-xs text-muted-foreground">
            ({fieldTypeString})
          </span>
        </label>
      </div>

      {isSelected && field.args.length > 0 ? (
        <div
          className="space-y-3 rounded-md border border-border p-3"
          style={{ marginLeft: depth * 12 + 12 }}
        >
          <div className="text-sm font-medium">Arguments</div>
          <div className="space-y-3">
            {field.args.map((arg) => {
              const mapping = mappingsByArgument[arg.name] ?? defaultMapping;
              const isArgEnabled = Boolean(mapping?.enabled);

              return (
                <div key={`${fieldPath}.${arg.name}`} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`arg-${fieldPath}-${arg.name}`}
                      checked={isArgEnabled}
                      onCheckedChange={(checked) =>
                        setArgumentMappingsByPath((previous) => {
                          const previousForPath = previous[fieldPath] ?? {};
                          const existing =
                            previousForPath[arg.name] ?? defaultMapping;

                          return {
                            ...previous,
                            [fieldPath]: {
                              ...previousForPath,
                              [arg.name]: {
                                ...existing,
                                enabled: Boolean(checked),
                              },
                            },
                          };
                        })
                      }
                      disabled={disabled}
                    />
                    <label
                      htmlFor={`arg-${fieldPath}-${arg.name}`}
                      className="cursor-pointer text-sm font-medium"
                    >
                      {arg.name}{' '}
                      <span className="text-xs text-muted-foreground">
                        ({getTypeString(arg.type)})
                      </span>
                    </label>
                  </div>

                  {isArgEnabled ? (
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-3">
                        <Label>
                          Fill from
                          <Select
                            value={mapping?.type ?? 'column'}
                            onValueChange={(value: 'column' | 'static') =>
                              setArgumentMappingsByPath((previous) => {
                                const previousForPath =
                                  previous[fieldPath] ?? {};
                                const existing = previousForPath[arg.name] ?? {
                                  ...defaultMapping,
                                  enabled: true,
                                };

                                return {
                                  ...previous,
                                  [fieldPath]: {
                                    ...previousForPath,
                                    [arg.name]: {
                                      ...existing,
                                      type: value,
                                      value:
                                        value === 'column'
                                          ? (tableColumnOptions[0] ?? '')
                                          : '',
                                    },
                                  },
                                };
                              })
                            }
                            disabled={disabled}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="column">
                                Source Field
                              </SelectItem>
                              <SelectItem value="static">
                                Static Value
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </Label>
                      </div>

                      <div className="col-span-9">
                        {mapping?.type === 'static' ? (
                          <Label>
                            Static value
                            <Input
                              value={mapping?.value ?? ''}
                              onChange={(event) =>
                                setArgumentMappingsByPath((previous) => {
                                  const previousForPath =
                                    previous[fieldPath] ?? {};
                                  const existing = previousForPath[
                                    arg.name
                                  ] ?? {
                                    ...defaultMapping,
                                    enabled: true,
                                    type: 'static' as const,
                                    value: '',
                                  };

                                  return {
                                    ...previous,
                                    [fieldPath]: {
                                      ...previousForPath,
                                      [arg.name]: {
                                        ...existing,
                                        value: event.target.value,
                                      },
                                    },
                                  };
                                })
                              }
                              placeholder='e.g. "100"'
                              disabled={disabled}
                              className="mt-1"
                            />
                          </Label>
                        ) : (
                          <Label>
                            Source field
                            <Select
                              value={mapping?.value ?? ''}
                              onValueChange={(value) =>
                                setArgumentMappingsByPath((previous) => {
                                  const previousForPath =
                                    previous[fieldPath] ?? {};
                                  const existing = previousForPath[
                                    arg.name
                                  ] ?? {
                                    ...defaultMapping,
                                    enabled: true,
                                    type: 'column' as const,
                                    value: '',
                                  };

                                  return {
                                    ...previous,
                                    [fieldPath]: {
                                      ...previousForPath,
                                      [arg.name]: {
                                        ...existing,
                                        value,
                                      },
                                    },
                                  };
                                })
                              }
                              disabled={
                                disabled || tableColumnOptions.length === 0
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select source field" />
                              </SelectTrigger>
                              <SelectContent>
                                {tableColumnOptions.length === 0 ? (
                                  <SelectItem value="" disabled>
                                    No source fields available
                                  </SelectItem>
                                ) : (
                                  tableColumnOptions.map((columnName) => (
                                    <SelectItem
                                      key={columnName}
                                      value={columnName}
                                    >
                                      {columnName}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </Label>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {isSelected && childFields.length > 0 ? (
        <div className="space-y-2">
          {childFields.map((childField) => (
            <RemoteSchemaFieldNode
              key={`${fieldPath}.${childField.name}`}
              schema={schema}
              field={childField}
              fieldPath={`${fieldPath}.${childField.name}`}
              selectedFieldPaths={selectedFieldPaths}
              setSelectedFieldPaths={setSelectedFieldPaths}
              argumentMappingsByPath={argumentMappingsByPath}
              setArgumentMappingsByPath={setArgumentMappingsByPath}
              tableColumnOptions={tableColumnOptions}
              disabled={disabled}
              depth={depth + 1}
              maxDepth={maxDepth}
              ancestorTypeNames={
                new Set([...ancestorTypeNames, namedType.name])
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export interface RemoteSchemaRelationshipDetailsValue {
  lhsFields: string[];
  remoteField?: unknown;
}

export interface RemoteSchemaRelationshipDetailsProps {
  remoteSchema: string;
  tableColumns: NormalizedQueryDataRow[];
  disabled?: boolean;
  onChange: (value: RemoteSchemaRelationshipDetailsValue) => void;
}

/**
 * Inline remote schema relationship field selector (no Dialog wrapper).
 * Intended to be embedded in other forms (e.g. inside `BaseRelationshipDialog`).
 */
export function RemoteSchemaRelationshipDetails({
  remoteSchema,
  tableColumns,
  disabled,
  onChange,
}: RemoteSchemaRelationshipDetailsProps) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [selectedRootFieldPath, setSelectedRootFieldPath] = useState('');
  const [selectedFieldPaths, setSelectedFieldPaths] = useState<Set<string>>(
    new Set(),
  );
  const [argumentMappingsByPath, setArgumentMappingsByPath] =
    useState<RemoteFieldArgumentMappingsByPath>({});

  const tableColumnOptions = useMemo(
    () =>
      tableColumns
        .map((column) => column?.column_name)
        .filter((columnName): columnName is string => Boolean(columnName)),
    [tableColumns],
  );

  const { data: targetIntrospectionData } = useIntrospectRemoteSchemaQuery(
    remoteSchema,
    {
      queryOptions: {
        enabled: !!remoteSchema,
      },
    },
  );

  const targetGraphqlSchema = useMemo(() => {
    if (!targetIntrospectionData) {
      return null;
    }
    return convertIntrospectionToSchema(targetIntrospectionData);
  }, [targetIntrospectionData]);

  useEffect(() => {
    // Reset selection when switching remote schemas.
    setSelectedRootFieldPath('');
    setSelectedFieldPaths(new Set());
    setArgumentMappingsByPath({});
    onChangeRef.current({ lhsFields: [], remoteField: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteSchema]);

  const remoteFieldObject = useMemo(() => {
    if (selectedFieldPaths.size === 0) {
      return null;
    }

    return buildRemoteFieldFromSelection(
      selectedFieldPaths,
      argumentMappingsByPath,
    );
  }, [argumentMappingsByPath, selectedFieldPaths]);

  const lhsFields = useMemo(
    () => extractLhsFieldsFromMappings(argumentMappingsByPath),
    [argumentMappingsByPath],
  );

  useEffect(() => {
    if (!remoteFieldObject) {
      onChangeRef.current({ lhsFields, remoteField: undefined });
      return;
    }

    onChangeRef.current({ lhsFields, remoteField: remoteFieldObject });
  }, [lhsFields, remoteFieldObject]);

  const remoteFieldsContent = useMemo(() => {
    if (!remoteSchema) {
      return (
        <p className="text-sm text-muted-foreground">
          Select a remote schema to browse available fields.
        </p>
      );
    }

    if (!targetGraphqlSchema) {
      return (
        <p className="text-sm text-muted-foreground">
          Loading remote schema types…
        </p>
      );
    }

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-medium">Root operation fields</div>
          {getOperationRoots(targetGraphqlSchema).map((root) => {
            const rootFields = Object.values(root.type.getFields());
            return (
              <div
                key={root.value}
                className="space-y-2 rounded-md border border-border p-3"
              >
                <div className="text-sm font-semibold">{root.label}</div>
                <div className="space-y-2">
                  {rootFields.map((rootField) => {
                    const rootFieldPath = rootField.name;
                    const checked = selectedRootFieldPath === rootFieldPath;
                    return (
                      <div
                        key={`${root.value}.${rootField.name}`}
                        className="flex items-center gap-3"
                      >
                        <Checkbox
                          id={`root-${root.value}-${rootField.name}`}
                          checked={checked}
                          onCheckedChange={(nextChecked) => {
                            const shouldSelect = Boolean(nextChecked);
                            if (!shouldSelect) {
                              setSelectedRootFieldPath('');
                              setSelectedFieldPaths(new Set());
                              setArgumentMappingsByPath({});
                              return;
                            }

                            setSelectedRootFieldPath(rootFieldPath);
                            setSelectedFieldPaths(new Set([rootFieldPath]));
                            setArgumentMappingsByPath({});
                          }}
                          disabled={disabled}
                        />
                        <label
                          htmlFor={`root-${root.value}-${rootField.name}`}
                          className="cursor-pointer text-sm"
                        >
                          <span className="font-medium">{rootField.name}</span>{' '}
                          <span className="text-xs text-muted-foreground">
                            ({getTypeString(rootField.type)})
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {selectedRootFieldPath ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="text-sm font-medium">Selected field tree</div>
            {(() => {
              const graphqlSchema = targetGraphqlSchema;
              const queryType = graphqlSchema.getQueryType();
              const mutationType = graphqlSchema.getMutationType();
              const subscriptionType = graphqlSchema.getSubscriptionType();
              const rootField =
                queryType?.getFields()[selectedRootFieldPath] ??
                mutationType?.getFields()[selectedRootFieldPath] ??
                subscriptionType?.getFields()[selectedRootFieldPath];

              if (!rootField) {
                return (
                  <p className="text-sm text-muted-foreground">
                    Unable to resolve the selected root field.
                  </p>
                );
              }

              return (
                <RemoteSchemaFieldNode
                  schema={graphqlSchema}
                  field={rootField}
                  fieldPath={selectedRootFieldPath}
                  selectedFieldPaths={selectedFieldPaths}
                  setSelectedFieldPaths={setSelectedFieldPaths}
                  argumentMappingsByPath={argumentMappingsByPath}
                  setArgumentMappingsByPath={setArgumentMappingsByPath}
                  tableColumnOptions={tableColumnOptions}
                  disabled={disabled}
                  depth={0}
                />
              );
            })()}
          </div>
        ) : null}
      </div>
    );
  }, [
    argumentMappingsByPath,
    disabled,
    remoteSchema,
    selectedRootFieldPath,
    selectedFieldPaths,
    tableColumnOptions,
    targetGraphqlSchema,
  ]);

  const remoteFieldPreview = remoteFieldObject
    ? JSON.stringify(remoteFieldObject, null, 2)
    : '{}';

  return (
    <div className="space-y-4">
      {remoteFieldsContent}

      <div className="space-y-2">
        <div className="text-sm font-medium">Remote field preview</div>
        <Textarea
          value={remoteFieldPreview}
          readOnly
          className="font-mono text-xs"
          rows={8}
        />
      </div>
    </div>
  );
}

export interface EditRemoteSchemaRelationshipDialogControlledProps {
  schema: string;
  tableName: string;
  source: string;
  relationship: MetadataRemoteRelationship | null;
  tableColumns: NormalizedQueryDataRow[];
  defaultRemoteSchema?: string;
  onSuccess?: () => Promise<void> | void;
}

export type EditRemoteSchemaRelationshipDialogProps = Omit<
  EditRemoteSchemaRelationshipDialogControlledProps,
  'open' | 'setOpen'
>;

export function EditRemoteSchemaRelationshipDialog({
  schema,
  tableName,
  source,
  relationship,
  tableColumns,
  defaultRemoteSchema,
  onSuccess,
}: EditRemoteSchemaRelationshipDialogControlledProps) {
  const [open, setOpen] = useState(false);
  const isEditing = Boolean(relationship);
  const [selectedRemoteSchema, setSelectedRemoteSchema] = useState('');
  const [relationshipName, setRelationshipName] = useState('');
  const [selectedRootFieldPath, setSelectedRootFieldPath] = useState('');
  const [selectedFieldPaths, setSelectedFieldPaths] = useState<Set<string>>(
    new Set(),
  );
  const [argumentMappingsByPath, setArgumentMappingsByPath] =
    useState<RemoteFieldArgumentMappingsByPath>({});
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

  const remoteFieldObject = useMemo(() => {
    if (selectedFieldPaths.size === 0) {
      return null;
    }

    return buildRemoteFieldFromSelection(
      selectedFieldPaths,
      argumentMappingsByPath,
    );
  }, [argumentMappingsByPath, selectedFieldPaths]);

  const remoteFieldPreview = remoteFieldObject
    ? JSON.stringify(remoteFieldObject, null, 2)
    : '{}';

  const lhsFields = useMemo(
    () => extractLhsFieldsFromMappings(argumentMappingsByPath),
    [argumentMappingsByPath],
  );

  const { data: targetIntrospectionData } = useIntrospectRemoteSchemaQuery(
    selectedRemoteSchema,
    {
      queryOptions: {
        enabled: !!selectedRemoteSchema,
      },
    },
  );

  const targetGraphqlSchema = useMemo(() => {
    if (!targetIntrospectionData) {
      return null;
    }
    return convertIntrospectionToSchema(targetIntrospectionData);
  }, [targetIntrospectionData]);

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const { mutateAsync: createRemoteRelationship, isLoading: isSaving } =
    useCreateRemoteRelationshipMutation();

  useEffect(() => {
    if (!open) {
      return;
    }

    // Create mode: preselect the remote schema if provided.
    if (!relationship && defaultRemoteSchema && !selectedRemoteSchema) {
      setSelectedRemoteSchema(defaultRemoteSchema);
    }
  }, [defaultRemoteSchema, open, relationship, selectedRemoteSchema]);

  useEffect(() => {
    const relationshipDefinition = relationship?.definition;
    if (
      !open ||
      !relationshipDefinition ||
      !isToRemoteSchemaRelationshipDefinition(relationshipDefinition)
    ) {
      return;
    }

    const remoteSchemaFromRelationship =
      relationshipDefinition.to_remote_schema.remote_schema ?? '';
    setSelectedRemoteSchema(remoteSchemaFromRelationship);
    setRelationshipName(relationship.name ?? '');

    const parsed = parseRemoteFieldToSelection(
      relationshipDefinition.to_remote_schema.remote_field,
    );
    setSelectedRootFieldPath(parsed.rootFieldPath);
    setSelectedFieldPaths(parsed.selectedFieldPaths);
    setArgumentMappingsByPath(parsed.argumentMappingsByPath);
    setFormError(null);
  }, [open, relationship]);

  const handleDialogChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setFormError(null);
      // Reset the create flow when closing.
      if (!relationship) {
        setSelectedRemoteSchema(defaultRemoteSchema ?? '');
        setRelationshipName('');
        setSelectedRootFieldPath('');
        setSelectedFieldPaths(new Set());
        setArgumentMappingsByPath({});
      }
    }

    setOpen(nextOpen);
  };

  const handleSave = async () => {
    if (!resourceVersion) {
      setFormError(
        'Metadata is not ready yet. Please wait a moment and try again.',
      );
      return;
    }

    const name = isEditing
      ? (relationship?.name ?? '').trim()
      : relationshipName.trim();

    if (!name) {
      setFormError('Please provide a relationship name.');
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
      name,
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
        await createRemoteRelationship({
          resourceVersion,
          args,
        });
        setOpen(false);
        await onSuccess?.();
      },
      {
        loadingMessage: isEditing
          ? 'Saving relationship...'
          : 'Creating relationship...',
        successMessage: isEditing
          ? 'Relationship updated successfully.'
          : 'Relationship created successfully.',
        errorMessage: isEditing
          ? 'Failed to update remote relationship.'
          : 'Failed to create remote relationship.',
      },
    );
  };

  const isRemoteSchemaDefinition = Boolean(
    relationship?.definition &&
      isToRemoteSchemaRelationshipDefinition(relationship.definition),
  );

  const remoteFieldsContent = useMemo(() => {
    if (!selectedRemoteSchema) {
      return (
        <p className="text-sm text-muted-foreground">
          Select a remote schema to browse available fields.
        </p>
      );
    }

    if (!targetGraphqlSchema) {
      return (
        <p className="text-sm text-muted-foreground">
          Loading remote schema types…
        </p>
      );
    }

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-medium">Root operation fields</div>
          {getOperationRoots(targetGraphqlSchema).map((root) => {
            const rootFields = Object.values(root.type.getFields());
            return (
              <div
                key={root.value}
                className="space-y-2 rounded-md border border-border p-3"
              >
                <div className="text-sm font-semibold">{root.label}</div>
                <div className="space-y-2">
                  {rootFields.map((rootField) => {
                    const rootFieldPath = rootField.name;
                    const checked = selectedRootFieldPath === rootFieldPath;
                    return (
                      <div
                        key={`${root.value}.${rootField.name}`}
                        className="flex items-center gap-3"
                      >
                        <Checkbox
                          id={`root-${root.value}-${rootField.name}`}
                          checked={checked}
                          onCheckedChange={(nextChecked) => {
                            const shouldSelect = Boolean(nextChecked);
                            if (!shouldSelect) {
                              setSelectedRootFieldPath('');
                              setSelectedFieldPaths(new Set());
                              setArgumentMappingsByPath({});
                              return;
                            }

                            setSelectedRootFieldPath(rootFieldPath);
                            setSelectedFieldPaths(new Set([rootFieldPath]));
                            setArgumentMappingsByPath({});
                          }}
                          disabled={isSaving}
                        />
                        <label
                          htmlFor={`root-${root.value}-${rootField.name}`}
                          className="cursor-pointer text-sm"
                        >
                          <span className="font-medium">{rootField.name}</span>{' '}
                          <span className="text-xs text-muted-foreground">
                            ({getTypeString(rootField.type)})
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {selectedRootFieldPath ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="text-sm font-medium">Selected field tree</div>
            {(() => {
              const graphqlSchema = targetGraphqlSchema;
              const queryType = graphqlSchema.getQueryType();
              const mutationType = graphqlSchema.getMutationType();
              const subscriptionType = graphqlSchema.getSubscriptionType();
              const rootField =
                queryType?.getFields()[selectedRootFieldPath] ??
                mutationType?.getFields()[selectedRootFieldPath] ??
                subscriptionType?.getFields()[selectedRootFieldPath];

              if (!rootField) {
                return (
                  <p className="text-sm text-muted-foreground">
                    Unable to resolve the selected root field.
                  </p>
                );
              }

              return (
                <RemoteSchemaFieldNode
                  schema={graphqlSchema}
                  field={rootField}
                  fieldPath={selectedRootFieldPath}
                  selectedFieldPaths={selectedFieldPaths}
                  setSelectedFieldPaths={setSelectedFieldPaths}
                  argumentMappingsByPath={argumentMappingsByPath}
                  setArgumentMappingsByPath={setArgumentMappingsByPath}
                  tableColumnOptions={tableColumnOptions}
                  disabled={isSaving}
                  depth={0}
                />
              );
            })()}
          </div>
        ) : null}
      </div>
    );
  }, [
    argumentMappingsByPath,
    isSaving,
    selectedRemoteSchema,
    selectedRootFieldPath,
    selectedFieldPaths,
    setArgumentMappingsByPath,
    setSelectedFieldPaths,
    tableColumnOptions,
    targetGraphqlSchema,
  ]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
      >
        <SquarePen className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto text-foreground sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {isEditing
                ? 'Edit Remote Schema Relationship'
                : 'Create Remote Schema Relationship'}
            </DialogTitle>
          </DialogHeader>

          {relationship && !isRemoteSchemaDefinition ? (
            <Alert severity="error">
              Unable to load this relationship. Please try again later.
            </Alert>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="space-y-2">
                <Label>Relationship name</Label>
                <Input
                  value={
                    isEditing ? (relationship?.name ?? '') : relationshipName
                  }
                  onChange={(event) => setRelationshipName(event.target.value)}
                  disabled={isSaving || isEditing}
                  placeholder="e.g. remote_schema_relationship"
                />
              </div>

              <div className="space-y-2">
                <Label>Remote schema</Label>
                <Select
                  value={selectedRemoteSchema}
                  onValueChange={(value) => {
                    setSelectedRemoteSchema(value);
                    // Reset selection state when switching remote schema.
                    setSelectedRootFieldPath('');
                    setSelectedFieldPaths(new Set());
                    setArgumentMappingsByPath({});
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
                  <h3 className="text-base font-medium">Remote fields</h3>
                </div>

                {remoteFieldsContent}
              </div>

              <div className="space-y-2">
                <Label>Remote field JSON</Label>
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
                <Label>Referenced columns</Label>
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
                  {isEditing ? 'Save Changes' : 'Create Relationship'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
