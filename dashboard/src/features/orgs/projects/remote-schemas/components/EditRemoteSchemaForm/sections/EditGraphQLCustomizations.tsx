import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { PencilIcon } from '@/components/ui/v2/icons/PencilIcon';
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
import isStandardGraphQLScalar from '@/features/orgs/projects/remote-schemas/utils/isStandardGraphQLScalar';
import { cn } from '@/lib/utils';
import type {
  GraphQLTypeForVisualization,
  GraphQLTypeForVisualizationFieldsItem,
  RemoteSchemaCustomizationFieldNamesItem,
} from '@/utils/hasura-api/generated/schemas';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Controller,
  useFieldArray,
  useFormContext,
  useWatch,
} from 'react-hook-form';
import TypeNameCustomizationCombobox from './TypeNameCustomizationCombobox';

export interface EditGraphQLCustomizationsProps {
  remoteSchemaName: string;
}

export default function EditGraphQLCustomizations({
  remoteSchemaName,
}: EditGraphQLCustomizationsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data, isLoading, error } =
    useIntrospectRemoteSchemaQuery(remoteSchemaName);

  const schemaTypes = useMemo(() => {
    // eslint-disable-next-line no-underscore-dangle
    const types = (data?.__schema?.types ??
      []) as GraphQLTypeForVisualization[];
    return types.filter(
      (t) => Boolean(t?.name) && !isStandardGraphQLScalar(t.name!),
    );
  }, [data]);

  const { control, register, getValues, setValue, unregister } =
    useFormContext();

  function getParentTypeFields(parentTypeName?: string) {
    const parentType = schemaTypes.find((t) => t.name === parentTypeName);
    return (parentType?.fields ??
      []) as GraphQLTypeForVisualizationFieldsItem[];
  }

  const {
    fields: fieldArrayFields,
    append: appendFieldName,
    remove: removeFieldName,
  } = useFieldArray({
    control,
    name: 'definition.customization.field_names',
  });

  const rawTypeNamesMapping = useWatch({
    name: 'definition.customization.type_names.mapping',
  });
  const rawFieldNames = useWatch({
    name: 'definition.customization.field_names',
  });

  useEffect(() => {
    const isObjectMapping =
      rawTypeNamesMapping &&
      typeof rawTypeNamesMapping === 'object' &&
      !Array.isArray(rawTypeNamesMapping);
    if (!isObjectMapping) {
      setValue(
        'definition.customization.type_names.mapping',
        {},
        {
          shouldDirty: true,
          shouldTouch: true,
        },
      );
    }
  }, [rawTypeNamesMapping, setValue]);

  const existingFieldNames: RemoteSchemaCustomizationFieldNamesItem[] =
    Array.isArray(rawFieldNames)
      ? (rawFieldNames as RemoteSchemaCustomizationFieldNamesItem[])
      : [];

  useEffect(() => {
    if (!Array.isArray(rawFieldNames)) {
      setValue('definition.customization.field_names', [], {
        shouldDirty: true,
        shouldTouch: true,
      });
    }
  }, [rawFieldNames, setValue]);

  const typeNamesMapping: Record<string, string> = useMemo(() => {
    if (
      rawTypeNamesMapping &&
      typeof rawTypeNamesMapping === 'object' &&
      !Array.isArray(rawTypeNamesMapping)
    ) {
      return rawTypeNamesMapping as Record<string, string>;
    }
    return {};
  }, [rawTypeNamesMapping]);

  const canAddTypeRemap = useMemo(
    () =>
      schemaTypes.some(
        (t) =>
          t?.name && !(typeNamesMapping as Record<string, string>)?.[t.name!],
      ),
    [schemaTypes, typeNamesMapping],
  );

  function addFirstAvailableTypeRemap() {
    const current = (getValues('definition.customization.type_names.mapping') ??
      {}) as Record<string, string>;
    const used = new Set(Object.keys(current));
    const candidate = schemaTypes.find((t) => t?.name && !used.has(t.name!));
    if (candidate?.name) {
      setValue(
        `definition.customization.type_names.mapping.${candidate.name}`,
        '',
        { shouldDirty: true, shouldTouch: true },
      );
    }
  }

  function changeTypeKey(oldKey: string, newKey: string) {
    if (!newKey || oldKey === newKey) {
      return;
    }
    const oldPath = `definition.customization.type_names.mapping.${oldKey}`;
    const newPath = `definition.customization.type_names.mapping.${newKey}`;
    const value = getValues(oldPath) ?? '';
    setValue(newPath, value, { shouldDirty: true, shouldTouch: true });
    unregister(oldPath);
  }

  function removeTypeRemap(key: string) {
    const path = `definition.customization.type_names.mapping.${key}`;
    unregister(path);
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

  if (!isOpen) {
    return (
      <Box className="space-y-4">
        <Text variant="h4" className="text-lg font-semibold">
          GraphQL Customizations
        </Text>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          startIcon={<PencilIcon />}
          onClick={() => setIsOpen(true)}
          className="mt-2 px-2"
        >
          Edit GraphQL Customization
        </Button>
      </Box>
    );
  }

  return (
    <Box className="space-y-4">
      <Box className="flex flex-row items-center justify-between">
        <Text variant="h4" className="text-lg font-semibold">
          GraphQL Customizations
        </Text>
        <Button
          variant="outlined"
          color="secondary"
          size="small"
          onClick={() => setIsOpen(false)}
        >
          Close
        </Button>
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
            {...register('definition.customization.root_fields_namespace', {
              setValueAs: (v) =>
                typeof v === 'string' && v.trim() === '' ? undefined : v,
            })}
            id="definition.customization.root_fields_namespace"
            name="definition.customization.root_fields_namespace"
            placeholder="namespace_"
            hideEmptyHelperText
            autoComplete="off"
            variant="inline"
            fullWidth
          />
        </Box>

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
              {...register('definition.customization.type_names.prefix', {
                setValueAs: (v) =>
                  typeof v === 'string' && v.trim() === '' ? undefined : v,
              })}
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
              {...register('definition.customization.type_names.suffix', {
                setValueAs: (v) =>
                  typeof v === 'string' && v.trim() === '' ? undefined : v,
              })}
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
        <Box className="flex flex-row items-center justify-between">
          <Box className="flex flex-row items-center space-x-2">
            <Text variant="h4" className="text-lg font-semibold">
              Rename Type Names
            </Text>
            <Tooltip title="Type remapping takes precedence to prefixes and suffixes.">
              <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
            </Tooltip>
          </Box>
          <Button
            variant="borderless"
            onClick={addFirstAvailableTypeRemap}
            disabled={!canAddTypeRemap}
          >
            <PlusIcon className="h-5 w-5" />
          </Button>
        </Box>

        <Box className="space-y-3">
          {Object.entries(typeNamesMapping).map(([fromType]) => (
            <Box key={fromType} className="rounded border p-3">
              <Box className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <TypeNameCustomizationCombobox
                  fromType={fromType}
                  schemaTypes={schemaTypes}
                  changeTypeKey={changeTypeKey}
                />
                <Box>
                  <Text className="font-medium">New name</Text>
                  <Controller
                    control={control}
                    name={`definition.customization.type_names.mapping.${fromType}`}
                    render={({ field }) => (
                      <Input
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="mt-1"
                        placeholder="New type name"
                        hideEmptyHelperText
                        autoComplete="off"
                        variant="inline"
                        fullWidth
                      />
                    )}
                  />
                </Box>
                <Box className="flex">
                  <Button
                    variant="borderless"
                    className="h-10 self-end"
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
      </Box>

      <Box className="space-y-4 rounded border-1 p-4">
        <Box className="flex flex-row items-center justify-between">
          <Box className="flex flex-row items-center space-x-2">
            <Text variant="h4" className="text-lg font-semibold">
              Field Names
            </Text>
            <Tooltip title="Add mappings for fields of a selected parent type. You can also set a prefix/suffix for those fields.">
              <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
            </Tooltip>
          </Box>
          <Button
            variant="borderless"
            onClick={() =>
              appendFieldName({} as RemoteSchemaCustomizationFieldNamesItem)
            }
          >
            <PlusIcon className="h-5 w-5" />
          </Button>
        </Box>

        <Box className="space-y-3">
          {fieldArrayFields?.map((row, index) => {
            const parentTypeValue =
              (Array.isArray(rawFieldNames) &&
                (rawFieldNames as RemoteSchemaCustomizationFieldNamesItem[])?.[
                  index
                ]?.parent_type) ||
              (row as any)?.parent_type;
            const fields = getParentTypeFields(parentTypeValue);
            return (
              <Box key={row.id ?? index} className="rounded border p-3">
                <Box className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <Box>
                    <Text className="font-medium">Parent type</Text>
                    <Controller
                      name={`definition.customization.field_names.${index}.parent_type`}
                      control={control}
                      defaultValue={(row as any)?.parent_type}
                      render={({ field }) => (
                        <Popover>
                          <PopoverTrigger asChild>
                            <ButtonV3
                              variant="outline"
                              role="combobox"
                              className={cn(
                                'mt-1 w-full justify-between overflow-hidden text-left',
                                !(field.value ?? '') && 'text-muted-foreground',
                              )}
                            >
                              <span className="truncate">
                                {field.value ?? 'Select a type'}
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
                                          (i, iIndex) =>
                                            iIndex !== index &&
                                            i.parent_type === t.name,
                                        ),
                                    )
                                    .map((t) => (
                                      <CommandItem
                                        value={t.name!}
                                        key={t.name!}
                                        onSelect={() => {
                                          unregister(
                                            `definition.customization.field_names.${index}.mapping`,
                                          );
                                          field.onChange(t.name!);
                                          setValue(
                                            `definition.customization.field_names.${index}.mapping`,
                                            {},
                                            {
                                              shouldDirty: true,
                                              shouldTouch: true,
                                            },
                                          );
                                        }}
                                        className="flex items-center"
                                      >
                                        <span className="min-w-0 flex-1 truncate">
                                          {t.name}
                                        </span>
                                        <Check
                                          className={cn(
                                            'ml-2 shrink-0',
                                            t.name === field.value
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
                      )}
                    />
                  </Box>
                  <Box>
                    <Text className="font-medium">Field Prefix</Text>
                    <Input
                      {...register(
                        `definition.customization.field_names.${index}.prefix`,
                        {
                          setValueAs: (v) =>
                            typeof v === 'string' && v.trim() === ''
                              ? undefined
                              : v,
                        },
                      )}
                      defaultValue={(row as any)?.prefix ?? ''}
                      placeholder="prefix_"
                      hideEmptyHelperText
                      autoComplete="off"
                      className="mt-1"
                    />
                  </Box>
                  <Box>
                    <Text className="font-medium">Field Suffix</Text>
                    <Input
                      {...register(
                        `definition.customization.field_names.${index}.suffix`,
                        {
                          setValueAs: (v) =>
                            typeof v === 'string' && v.trim() === ''
                              ? undefined
                              : v,
                        },
                      )}
                      defaultValue={(row as any)?.suffix ?? ''}
                      placeholder="_suffix"
                      hideEmptyHelperText
                      autoComplete="off"
                      className="mt-1"
                      variant="inline"
                      fullWidth
                    />
                  </Box>
                  <Box className="flex">
                    <Button
                      variant="borderless"
                      className="h-10 self-end"
                      color="error"
                      onClick={() => removeFieldName(index)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </Box>
                </Box>

                {fields.length > 0 && (
                  <Box className="mt-3 space-y-2">
                    <Text className="font-medium">Field remaps</Text>
                    <Box className="space-y-2">
                      {fields.map((f) => {
                        const key = f.name;
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
                            <Controller
                              control={control}
                              name={`definition.customization.field_names.${index}.mapping.${key}`}
                              render={({ field }) => (
                                <Input
                                  value={field.value ?? ''}
                                  onChange={(e) =>
                                    field.onChange(e.target.value)
                                  }
                                  placeholder="new_field_name"
                                  hideEmptyHelperText
                                  autoComplete="off"
                                  variant="inline"
                                  fullWidth
                                />
                              )}
                            />
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
