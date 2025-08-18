import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Button as ButtonV3 } from '@/components/ui/v3/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/v3/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import useIntrospectRemoteSchemaQuery from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery/useIntrospectRemoteSchemaQuery';
import { cn } from '@/lib/utils';
import type {
  GraphQLTypeForVisualization,
  GraphQLTypeForVisualizationFieldsItem,
  RemoteSchemaCustomizationFieldNamesItem,
} from '@/utils/hasura-api/generated/schemas';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

export interface EditGraphQLCustomizationsProps {
  remoteSchemaName: string;
}

export default function EditGraphQLCustomizations({
  remoteSchemaName,
}: EditGraphQLCustomizationsProps) {
  const { data, isLoading, error } =
    useIntrospectRemoteSchemaQuery(remoteSchemaName);

  const schemaTypes = useMemo(() => {
    /* eslint-disable-next-line no-underscore-dangle */
    const types = (data?.data?.__schema?.types ??
      []) as GraphQLTypeForVisualization[];
    // Filter only concrete object types with fields; exclude introspection and wrappers
    return types.filter(
      (t) =>
        Boolean(t?.name) &&
        !String(t?.name).startsWith('__') &&
        t?.kind === 'OBJECT' &&
        Array.isArray(t?.fields) &&
        (t?.fields?.length ?? 0) > 0,
    );
  }, [data]);

  const { register, getValues, setValue } = useFormContext();

  const [newFieldMapping, setNewFieldMapping] = useState<{
    parent_type?: string;
    prefix?: string;
    suffix?: string;
    mapping?: Record<string, string>;
  }>({});

  function getParentTypeFields(parentTypeName?: string) {
    const parentType = schemaTypes.find((t) => t.name === parentTypeName);
    return (parentType?.fields ??
      []) as GraphQLTypeForVisualizationFieldsItem[];
  }

  function upsertFieldNames(items: RemoteSchemaCustomizationFieldNamesItem[]) {
    setValue('definition.customization.field_names', items, {
      shouldDirty: true,
      shouldTouch: true,
    });
  }

  function addFieldMapping() {
    const existing: RemoteSchemaCustomizationFieldNamesItem[] =
      getValues('definition.customization.field_names') ?? [];
    const next = [...existing, newFieldMapping];
    upsertFieldNames(next);
    setNewFieldMapping({});
  }

  function updateFieldMappingAt(
    index: number,
    update: Partial<RemoteSchemaCustomizationFieldNamesItem>,
  ) {
    const existing: RemoteSchemaCustomizationFieldNamesItem[] =
      getValues('definition.customization.field_names') ?? [];
    const next = existing.map((item, i) =>
      i === index ? { ...item, ...update } : item,
    );
    upsertFieldNames(next);
  }

  function removeFieldMappingAt(index: number) {
    const existing: RemoteSchemaCustomizationFieldNamesItem[] =
      getValues('definition.customization.field_names') ?? [];
    const next = existing.filter((_, i) => i !== index);
    upsertFieldNames(next);
  }

  // Watch field_names/type_names to keep UI reactive and sanitize shapes
  const rawTypeNamesMapping = useWatch({
    name: 'definition.customization.type_names.mapping',
  });
  const rawFieldNames = useWatch({
    name: 'definition.customization.field_names',
  });

  const existingFieldNames: RemoteSchemaCustomizationFieldNamesItem[] =
    Array.isArray(rawFieldNames)
      ? (rawFieldNames as RemoteSchemaCustomizationFieldNamesItem[])
      : [];

  const typeNamesMapping: Record<string, string> =
    rawTypeNamesMapping &&
    typeof rawTypeNamesMapping === 'object' &&
    !Array.isArray(rawTypeNamesMapping)
      ? (rawTypeNamesMapping as Record<string, string>)
      : {};

  function setTypeNamesMapping(next: Record<string, string>) {
    setValue('definition.customization.type_names.mapping', next, {
      shouldDirty: true,
      shouldTouch: true,
    });
  }

  function changeTypeKey(oldKey: string, newKey: string) {
    if (!newKey || oldKey === newKey) {
      return;
    }
    const current = (getValues('definition.customization.type_names.mapping') ??
      {}) as Record<string, string>;
    const value = current[oldKey] ?? '';
    const next: Record<string, string> = {};
    Object.entries(current).forEach(([k, v]) => {
      if (k === oldKey) {
        return;
      }
      if (!(k in next)) {
        next[k] = v;
      }
    });
    next[newKey] = value;
    setTypeNamesMapping(next);
  }

  function updateTypeValue(key: string, value: string) {
    const current = (getValues('definition.customization.type_names.mapping') ??
      {}) as Record<string, string>;
    const next = { ...current } as Record<string, string>;
    if (!value) {
      delete next[key];
    } else {
      next[key] = value;
    }
    setTypeNamesMapping(next);
  }

  const [newTypeRemap, setNewTypeRemap] = useState<{
    type?: string;
    renamed?: string;
  }>({});

  function addTypeRemap() {
    const current = (getValues('definition.customization.type_names.mapping') ??
      {}) as Record<string, string>;
    if (!newTypeRemap.type) {
      return;
    }
    const next = {
      ...current,
      [newTypeRemap.type!]: newTypeRemap.renamed ?? '',
    } as Record<string, string>;
    setTypeNamesMapping(next);
    setNewTypeRemap({});
  }
  function removeTypeRemap(key: string) {
    const current = (getValues('definition.customization.type_names.mapping') ??
      {}) as Record<string, string>;
    const next = { ...current } as Record<string, string>;
    delete next[key];
    setTypeNamesMapping(next);
  }

  if (isLoading) {
    return (
      <Box className="space-y-2">
        <Text variant="h4" className="text-lg font-semibold">
          GraphQL Customizations
        </Text>
        <Text variant="body2" color="secondary" className="text-sm">
          Introspecting remote schema...
        </Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className="space-y-2">
        <Text variant="h4" className="text-lg font-semibold">
          GraphQL Customizations
        </Text>
        <Text variant="body2" color="error" className="text-sm">
          Failed to introspect remote schema. Type/field mapping is unavailable.
        </Text>
      </Box>
    );
  }

  return (
    <Box className="space-y-4">
      {/* Hidden input to register field_names so changes mark form as dirty */}
      <input
        type="hidden"
        {...register('definition.customization.field_names' as any)}
      />
      {/* Hidden input to register type_names.mapping so defaults populate and dirty state tracks */}
      <input
        type="hidden"
        {...register('definition.customization.type_names.mapping' as any)}
      />
      <Box className="flex flex-row items-center space-x-2">
        <Text variant="h4" className="text-lg font-semibold">
          GraphQL Customizations
        </Text>
      </Box>

      <Box className="space-y-4 rounded border-1 p-4">
        <Box className="space-y-2">
          <Box className="flex flex-row items-center space-x-2">
            <Text className="font-medium">Root Field Namespace</Text>
            <Tooltip title="Root field type names will be prefixed by this name.">
              <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
            </Tooltip>
          </Box>
          <Input
            {...register('definition.customization.root_fields_namespace')}
            id="definition.customization.root_fields_namespace"
            name="definition.customization.root_fields_namespace"
            placeholder="namespace_"
            hideEmptyHelperText
            autoComplete="off"
            variant="inline"
            fullWidth
          />
        </Box>

        {/* Type Names prefix/suffix */}
        <Box className="space-y-3">
          <Box className="flex flex-row items-center space-x-2">
            <Text variant="h4" className="text-lg font-semibold">
              Types
            </Text>
            <Tooltip title="Add a prefix / suffix to all types of the remote schema">
              <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
            </Tooltip>
          </Box>

          <Box className="space-y-2">
            <Text className="font-medium">Prefix</Text>
            <Input
              {...register('definition.customization.type_names.prefix')}
              id="definition.customization.type_names.prefix"
              name="definition.customization.type_names.prefix"
              placeholder="prefix_"
              hideEmptyHelperText
              autoComplete="off"
              variant="inline"
              fullWidth
            />
          </Box>

          <Box className="space-y-2">
            <Text className="font-medium">Suffix</Text>
            <Input
              {...register('definition.customization.type_names.suffix')}
              id="definition.customization.type_names.suffix"
              name="definition.customization.type_names.suffix"
              placeholder="_suffix"
              hideEmptyHelperText
              autoComplete="off"
              variant="inline"
              fullWidth
            />
          </Box>
        </Box>
      </Box>

      <Box className="space-y-4 rounded border-1 p-4">
        <Box className="flex flex-row items-center space-x-2">
          <Text variant="h4" className="text-lg font-semibold">
            Rename Type Names
          </Text>
          <Tooltip title="Type remapping takes precedence to prefixes and suffixes.">
            <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
          </Tooltip>
        </Box>

        <Box className="space-y-3">
          {Object.entries(typeNamesMapping).map(([fromType, toType]) => (
            <Box key={fromType} className="rounded border p-3">
              <Box className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Box>
                  <Text className="font-medium">Type</Text>
                  <Popover>
                    <PopoverTrigger asChild>
                      <ButtonV3
                        variant="outline"
                        role="combobox"
                        className={cn(
                          'w-full justify-between overflow-hidden text-left',
                          !fromType && 'text-muted-foreground',
                        )}
                      >
                        <span className="truncate">
                          {fromType || 'Select a type'}
                        </span>
                        <ChevronsUpDown className="ml-2 shrink-0 opacity-50" />
                      </ButtonV3>
                    </PopoverTrigger>
                    <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search type..."
                          className="h-9"
                        />
                        <CommandList>
                          <CommandEmpty>No type found.</CommandEmpty>
                          <CommandGroup>
                            {schemaTypes.map((t) => (
                              <CommandItem
                                value={t.name!}
                                key={t.name!}
                                onSelect={() =>
                                  changeTypeKey(fromType, t.name!)
                                }
                                className="flex items-center"
                              >
                                <span className="min-w-0 flex-1 truncate">
                                  {t.name}
                                </span>
                                <Check
                                  className={cn(
                                    'ml-2 shrink-0',
                                    t.name === fromType
                                      ? 'opacity-100'
                                      : 'opacity-0',
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </Box>
                <Box>
                  <Text className="font-medium">New name</Text>
                  <Input
                    value={toType ?? ''}
                    onChange={({ target: { value } }) =>
                      updateTypeValue(fromType, value)
                    }
                    placeholder="New type name"
                    hideEmptyHelperText
                    autoComplete="off"
                    variant="inline"
                    fullWidth
                  />
                </Box>
                <Box className="flex items-end justify-end md:justify-start">
                  <Button
                    variant="borderless"
                    className="col-span-1"
                    color="error"
                    onClick={() => removeTypeRemap(fromType)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>

        {/* Add new type remap */}
        <Box className="rounded border p-3">
          <Box className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Box>
              <Text className="font-medium">Type</Text>
              <Popover>
                <PopoverTrigger asChild>
                  <ButtonV3
                    variant="outline"
                    role="combobox"
                    className={cn(
                      'w-full justify-between overflow-hidden text-left',
                      !(newTypeRemap.type ?? '') && 'text-muted-foreground',
                    )}
                  >
                    <span className="truncate">
                      {newTypeRemap.type ?? 'Select a type'}
                    </span>
                    <ChevronsUpDown className="ml-2 shrink-0 opacity-50" />
                  </ButtonV3>
                </PopoverTrigger>
                <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search type..."
                      className="h-9"
                    />
                    <CommandList>
                      <CommandEmpty>No type found.</CommandEmpty>
                      <CommandGroup>
                        {schemaTypes
                          .filter((t) => !typeNamesMapping?.[t.name!])
                          .map((t) => (
                            <CommandItem
                              value={t.name!}
                              key={t.name!}
                              onSelect={() =>
                                setNewTypeRemap((s) => ({
                                  ...s,
                                  type: t.name!,
                                }))
                              }
                              className="flex items-center"
                            >
                              <span className="min-w-0 flex-1 truncate">
                                {t.name}
                              </span>
                              <Check
                                className={cn(
                                  'ml-2 shrink-0',
                                  t.name === newTypeRemap.type
                                    ? 'opacity-100'
                                    : 'opacity-0',
                                )}
                              />
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </Box>
            <Box>
              <Text className="font-medium">New name</Text>
              <Input
                value={newTypeRemap.renamed ?? ''}
                onChange={({ target: { value } }) =>
                  setNewTypeRemap((s) => ({ ...s, renamed: value }))
                }
                placeholder="New type name"
                hideEmptyHelperText
                autoComplete="off"
                variant="inline"
                fullWidth
              />
            </Box>
            <Box className="flex items-end justify-end md:justify-start">
              <Button
                variant="borderless"
                className="col-span-1"
                onClick={addTypeRemap}
                disabled={!newTypeRemap.type}
              >
                <PlusIcon className="h-5 w-5" />
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Field Names Mappings */}
      <Box className="space-y-4 rounded border-1 p-4">
        <Box className="flex flex-row items-center space-x-2">
          <Text variant="h4" className="text-lg font-semibold">
            Field Names
          </Text>
          <Tooltip title="Add mappings for fields of a selected parent type. You can also set a prefix/suffix for those fields.">
            <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
          </Tooltip>
        </Box>

        {/* Existing items */}
        <Box className="space-y-3">
          {existingFieldNames?.map((item, index) => {
            const fields = getParentTypeFields(item.parent_type);
            return (
              // eslint-disable-next-line react/no-array-index-key
              <Box
                key={item.parent_type ?? index}
                className="rounded border p-3"
              >
                <Box className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Box>
                    <Text className="font-medium">Parent type</Text>
                    <Popover>
                      <PopoverTrigger asChild>
                        <ButtonV3
                          variant="outline"
                          role="combobox"
                          className={cn(
                            'w-full justify-between overflow-hidden text-left',
                            !(item.parent_type ?? '') &&
                              'text-muted-foreground',
                          )}
                        >
                          <span className="truncate">
                            {item.parent_type ?? 'Select a type'}
                          </span>
                          <ChevronsUpDown className="ml-2 shrink-0 opacity-50" />
                        </ButtonV3>
                      </PopoverTrigger>
                      <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
                        <Command>
                          <CommandInput
                            placeholder="Search type..."
                            className="h-9"
                          />
                          <CommandList>
                            <CommandEmpty>No type found.</CommandEmpty>
                            <CommandGroup>
                              {schemaTypes.map((t) => (
                                <CommandItem
                                  value={t.name!}
                                  key={t.name!}
                                  onSelect={() => {
                                    updateFieldMappingAt(index, {
                                      parent_type: t.name!,
                                      mapping: {},
                                    });
                                  }}
                                  className="flex items-center"
                                >
                                  <span className="min-w-0 flex-1 truncate">
                                    {t.name}
                                  </span>
                                  <Check
                                    className={cn(
                                      'ml-2 shrink-0',
                                      t.name === item.parent_type
                                        ? 'opacity-100'
                                        : 'opacity-0',
                                    )}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </Box>
                  <Box>
                    <Text className="font-medium">Prefix</Text>
                    <Input
                      value={item.prefix ?? ''}
                      onChange={(e) =>
                        updateFieldMappingAt(index, { prefix: e.target.value })
                      }
                      placeholder="prefix_"
                      hideEmptyHelperText
                      autoComplete="off"
                      variant="inline"
                      fullWidth
                    />
                  </Box>
                  <Box className="flex items-end justify-end md:justify-start">
                    <Button
                      variant="borderless"
                      className="col-span-1"
                      color="error"
                      onClick={() => removeFieldMappingAt(index)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </Box>
                </Box>

                {/* Field remaps */}
                <Box className="mt-3 space-y-2">
                  <Text className="font-medium">Field remaps</Text>
                  <Box className="space-y-2">
                    {fields.map((f) => {
                      const key = f.name;
                      const current = item.mapping?.[key] ?? '';
                      return (
                        <Box
                          key={key}
                          className="grid grid-cols-1 gap-2 md:grid-cols-2"
                        >
                          <Input
                            disabled
                            value={key}
                            variant="inline"
                            fullWidth
                          />
                          <Input
                            value={current}
                            onChange={({ target: { value } }) => {
                              const nextMapping = {
                                ...(item.mapping ?? {}),
                              } as Record<string, string>;
                              if (!value) {
                                delete nextMapping[key];
                              } else {
                                nextMapping[key] = value;
                              }
                              updateFieldMappingAt(index, {
                                mapping: nextMapping,
                              });
                            }}
                            placeholder="new_field_name"
                            hideEmptyHelperText
                            autoComplete="off"
                            variant="inline"
                            fullWidth
                          />
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* Add new item */}
        <Box className="rounded border p-3">
          <Box className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Box>
              <Text className="font-medium">Parent type</Text>
              <Popover>
                <PopoverTrigger asChild>
                  <ButtonV3
                    variant="outline"
                    role="combobox"
                    className={cn(
                      'w-full justify-between overflow-hidden text-left',
                      !(newFieldMapping.parent_type ?? '') &&
                        'text-muted-foreground',
                    )}
                  >
                    <span className="truncate">
                      {newFieldMapping.parent_type ?? 'Select a type'}
                    </span>
                    <ChevronsUpDown className="ml-2 shrink-0 opacity-50" />
                  </ButtonV3>
                </PopoverTrigger>
                <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search type..."
                      className="h-9"
                    />
                    <CommandList>
                      <CommandEmpty>No type found.</CommandEmpty>
                      <CommandGroup>
                        {schemaTypes
                          .filter(
                            (t) =>
                              !(existingFieldNames ?? []).some(
                                (i) => i.parent_type === t.name,
                              ),
                          )
                          .map((t) => (
                            <CommandItem
                              value={t.name!}
                              key={t.name!}
                              onSelect={() => {
                                setNewFieldMapping((s) => ({
                                  ...s,
                                  parent_type: t.name!,
                                  mapping: {},
                                }));
                              }}
                              className="flex items-center"
                            >
                              <span className="min-w-0 flex-1 truncate">
                                {t.name}
                              </span>
                              <Check
                                className={cn(
                                  'ml-2 shrink-0',
                                  t.name === newFieldMapping.parent_type
                                    ? 'opacity-100'
                                    : 'opacity-0',
                                )}
                              />
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </Box>
            <Box>
              <Text className="font-medium">Prefix</Text>
              <Input
                value={newFieldMapping.prefix ?? ''}
                onChange={(e) =>
                  setNewFieldMapping((s) => ({ ...s, prefix: e.target.value }))
                }
                placeholder="prefix_"
                hideEmptyHelperText
                autoComplete="off"
                variant="inline"
                fullWidth
              />
            </Box>
            <Box className="flex items-end justify-end md:justify-start">
              <Button
                variant="borderless"
                className="col-span-1"
                onClick={addFieldMapping}
                disabled={!newFieldMapping.parent_type}
              >
                <PlusIcon className="h-5 w-5" />
              </Button>
            </Box>
          </Box>

          {/* Render remap inputs for the selected new parent type */}
          {newFieldMapping.parent_type ? (
            <Box className="mt-3 space-y-2">
              <Text className="font-medium">Field remaps</Text>
              <Box className="space-y-2">
                {getParentTypeFields(newFieldMapping.parent_type).map((f) => {
                  const key = f.name;
                  const current = newFieldMapping.mapping?.[key] ?? '';
                  return (
                    <Box
                      key={key}
                      className="grid grid-cols-1 gap-2 md:grid-cols-2"
                    >
                      <Input disabled value={key} variant="inline" fullWidth />
                      <Input
                        value={current}
                        onChange={({ target: { value } }) => {
                          setNewFieldMapping((s) => {
                            const nextMapping = {
                              ...(s.mapping ?? {}),
                            } as Record<string, string>;
                            if (!value) {
                              delete nextMapping[key];
                            } else {
                              nextMapping[key] = value;
                            }
                            return { ...s, mapping: nextMapping };
                          });
                        }}
                        placeholder="new_field_name"
                        hideEmptyHelperText
                        autoComplete="off"
                        variant="inline"
                        fullWidth
                      />
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
