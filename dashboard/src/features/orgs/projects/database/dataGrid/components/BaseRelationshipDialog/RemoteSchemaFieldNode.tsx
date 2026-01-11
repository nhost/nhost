import { Checkbox } from '@/components/ui/v3/checkbox';
import { Input } from '@/components/ui/v3/input';
import { Label } from '@/components/ui/v3/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import type {
  RemoteFieldArgumentMapping,
  RemoteFieldArgumentMappingsByPath,
} from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';
import getTypeString from '@/features/orgs/projects/remote-schemas/utils/getTypeString';
import unwrapNamedType from '@/features/orgs/projects/remote-schemas/utils/unwrapNamedType';
import { cn } from '@/lib/utils';
import { isObjectType, type GraphQLField, type GraphQLSchema } from 'graphql';
import { useMemo, type Dispatch, type SetStateAction } from 'react';

interface RemoteSchemaFieldNodeProps {
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
}

export default function RemoteSchemaFieldNode({
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

  const hasToggle = field.args.length > 0 || canRecurse;

  const setSelected = (checked: boolean) => {
    setSelectedFieldPaths((previous) => {
      const next = new Set(previous);
      if (checked) {
        const parts = fieldPath.split('.');
        for (let i = 1; i <= parts.length; i += 1) {
          next.add(parts.slice(0, i).join('.'));
        }
      } else {
        Array.from(next).forEach((path) => {
          if (path === fieldPath || path.startsWith(`${fieldPath}.`)) {
            next.delete(path);
          }
        });
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
        {hasToggle ? (
          <>
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
          </>
        ) : (
          <span className="text-sm">
            <span className="font-medium">{field.name}</span>{' '}
            <span className="text-xs text-muted-foreground">
              ({fieldTypeString})
            </span>
          </span>
        )}
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
