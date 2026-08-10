import {
  Check,
  ChevronsUpDown,
  InfoIcon,
  SquarePen as PencilIcon,
  PlusIcon,
  Trash2 as TrashIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Controller,
  useFieldArray,
  useFormContext,
  useWatch,
} from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/v3/command';
import { Input } from '@/components/ui/v3/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import useIntrospectRemoteSchemaQuery from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery/useIntrospectRemoteSchemaQuery';
import isStandardGraphQLScalar from '@/features/orgs/projects/remote-schemas/utils/isStandardGraphQLScalar';
import { cn } from '@/lib/utils';
import type {
  GraphQLTypeForVisualization,
  GraphQLTypeForVisualizationFieldsItem,
  RemoteSchemaCustomizationFieldNamesItem,
} from '@/utils/hasura-api/generated/schemas';
import TypeNameCustomizationCombobox from './TypeNameCustomizationCombobox';

function InfoTooltip({ title }: { title: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label="Info" className="flex items-center">
          <InfoIcon className="h-4 w-4 text-primary" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{title}</TooltipContent>
    </Tooltip>
  );
}

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
      <div className="space-y-2">
        <h4 className="font-semibold text-lg">GraphQL Customizations</h4>
        <p className="text-muted-foreground text-sm">
          Introspecting remote schema...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <h4 className="font-semibold text-lg">GraphQL Customizations</h4>
        <p className="text-destructive text-sm">
          Failed to introspect remote schema. Type/field mapping is unavailable.
        </p>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div className="space-y-4">
        <h4 className="font-semibold text-lg">GraphQL Customizations</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="mt-2 gap-1 border-blue-600 px-2 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
        >
          <PencilIcon className="h-4 w-4" />
          Edit GraphQL Customization
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-row items-center justify-between">
        <h4 className="font-semibold text-lg">GraphQL Customizations</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(false)}
        >
          Close
        </Button>
      </div>

      <div className="box space-y-4 rounded border-1 p-4">
        <div className="space-y-2">
          <div className="flex flex-row items-center space-x-2">
            <p className="font-medium">Root Field Namespace</p>
            <InfoTooltip title="Root field type names will be prefixed by this name." />
          </div>
          <Input
            {...register('definition.customization.root_fields_namespace', {
              setValueAs: (v) =>
                typeof v === 'string' && v.trim() === '' ? undefined : v,
            })}
            id="definition.customization.root_fields_namespace"
            name="definition.customization.root_fields_namespace"
            placeholder="namespace_"
            autoComplete="off"
          />
        </div>

        <div className="space-y-3">
          <div className="flex flex-row items-center space-x-2">
            <h4 className="font-semibold text-lg">Types</h4>
            <InfoTooltip title="Add a prefix / suffix to all types of the remote schema" />
          </div>

          <div className="space-y-2">
            <p className="font-medium">Prefix</p>
            <Input
              {...register('definition.customization.type_names.prefix', {
                setValueAs: (v) =>
                  typeof v === 'string' && v.trim() === '' ? undefined : v,
              })}
              id="definition.customization.type_names.prefix"
              name="definition.customization.type_names.prefix"
              placeholder="prefix_"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <p className="font-medium">Suffix</p>
            <Input
              {...register('definition.customization.type_names.suffix', {
                setValueAs: (v) =>
                  typeof v === 'string' && v.trim() === '' ? undefined : v,
              })}
              id="definition.customization.type_names.suffix"
              name="definition.customization.type_names.suffix"
              placeholder="_suffix"
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      <div className="box space-y-4 rounded border-1 p-4">
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-row items-center space-x-2">
            <h4 className="font-semibold text-lg">Rename Type Names</h4>
            <InfoTooltip title="Type remapping takes precedence to prefixes and suffixes." />
          </div>
          <Button
            aria-label="Add type remap"
            type="button"
            variant="ghost"
            size="icon"
            onClick={addFirstAvailableTypeRemap}
            disabled={!canAddTypeRemap}
          >
            <PlusIcon className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-3">
          {Object.entries(typeNamesMapping).map(([fromType]) => (
            <div key={fromType} className="box rounded border p-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <TypeNameCustomizationCombobox
                  fromType={fromType}
                  schemaTypes={schemaTypes}
                  changeTypeKey={changeTypeKey}
                />
                <div>
                  <p className="font-medium">New name</p>
                  <Controller
                    control={control}
                    name={`definition.customization.type_names.mapping.${fromType}`}
                    render={({ field }) => (
                      <Input
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="mt-1"
                        placeholder="New type name"
                        autoComplete="off"
                      />
                    )}
                  />
                </div>
                <div className="flex">
                  <Button
                    className="h-10 self-end text-destructive hover:text-destructive"
                    aria-label="Remove type remap"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTypeRemap(fromType)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="box space-y-4 rounded border-1 p-4">
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-row items-center space-x-2">
            <h4 className="font-semibold text-lg">Field Names</h4>
            <InfoTooltip title="Add mappings for fields of a selected parent type. You can also set a prefix/suffix for those fields." />
          </div>
          <Button
            aria-label="Add field name"
            variant="ghost"
            size="icon"
            onClick={() =>
              appendFieldName({} as RemoteSchemaCustomizationFieldNamesItem)
            }
          >
            <PlusIcon className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-3">
          {fieldArrayFields?.map((row, index) => {
            const parentTypeValue =
              (Array.isArray(rawFieldNames) &&
                (rawFieldNames as RemoteSchemaCustomizationFieldNamesItem[])?.[
                  index
                ]?.parent_type) ||
              // biome-ignore lint/suspicious/noExplicitAny: TODO
              (row as any)?.parent_type;
            const fields = getParentTypeFields(parentTypeValue);
            return (
              <div key={row.id ?? index} className="box rounded border p-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div>
                    <p className="font-medium">Parent type</p>
                    <Controller
                      name={`definition.customization.field_names.${index}.parent_type`}
                      control={control}
                      // biome-ignore lint/suspicious/noExplicitAny: TODO
                      defaultValue={(row as any)?.parent_type}
                      render={({ field }) => (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
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
                            </Button>
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
                  </div>
                  <div>
                    <p className="font-medium">Field Prefix</p>
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
                      // biome-ignore lint/suspicious/noExplicitAny: TODO
                      defaultValue={(row as any)?.prefix ?? ''}
                      placeholder="prefix_"
                      autoComplete="off"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <p className="font-medium">Field Suffix</p>
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
                      // biome-ignore lint/suspicious/noExplicitAny: TODO
                      defaultValue={(row as any)?.suffix ?? ''}
                      placeholder="_suffix"
                      autoComplete="off"
                      className="mt-1"
                    />
                  </div>
                  <div className="flex">
                    <Button
                      className="h-10 self-end text-destructive hover:text-destructive"
                      aria-label="Remove field name"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFieldName(index)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {fields.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="font-medium">Field remaps</p>
                    <div className="space-y-2">
                      {fields.map((f) => {
                        const key = f.name;
                        return (
                          <div
                            key={key}
                            className="grid grid-cols-1 gap-2 md:grid-cols-2"
                          >
                            <Input disabled value={key} />
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
                                  autoComplete="off"
                                />
                              )}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
