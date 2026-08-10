import { InfoIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import type { Transformer } from '@/components/form/utils/getTransformedFieldProps';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { BaseRemoteSchemaFormValues } from './BaseRemoteSchemaForm';

const emptyStringToUndefined: Transformer = {
  in: (value) => value ?? '',
  out: (event) => {
    const value = event?.target?.value;
    return typeof value === 'string' && value.trim() === '' ? undefined : value;
  },
};

function CustomizationDescription() {
  return (
    <p className="text-muted-foreground text-sm">
      Individual Types and Fields will be editable after saving.{' '}
      <a
        href="https://spec.graphql.org/June2018/#example-e2969"
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline hover:text-blue-800"
      >
        Read more
      </a>{' '}
      in the official GraphQL spec.
    </p>
  );
}

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

export default function GraphQLCustomizations() {
  const [isOpen, setIsOpen] = useState(false);
  const { control, getFieldState, formState } =
    useFormContext<BaseRemoteSchemaFormValues>();

  const queryRootError = getFieldState(
    'definition.customization.query_root',
    formState,
  ).error;
  const mutationRootError = getFieldState(
    'definition.customization.mutation_root',
    formState,
  ).error;

  if (!isOpen) {
    return (
      <div className="space-y-4">
        <div className="flex h-8 flex-row items-center justify-between">
          <h4 className="font-semibold text-lg">GraphQL Customizations</h4>
        </div>
        <CustomizationDescription />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="mt-2 gap-1 px-2"
        >
          <PlusIcon className="h-4 w-4" />
          Add GraphQL Customization
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

      <CustomizationDescription />

      <div className="box space-y-4 rounded border p-4">
        <FormInput
          control={control}
          name="definition.customization.root_fields_namespace"
          transform={emptyStringToUndefined}
          label={
            <span className="flex flex-row items-center gap-2">
              Root Field Namespace
              <InfoTooltip title="Root field type names will be under this namespace." />
            </span>
          }
          placeholder="namespace_"
          autoComplete="off"
        />

        <div className="space-y-3">
          <div className="flex flex-row items-center space-x-2">
            <h4 className="font-semibold text-lg">Types</h4>
            <InfoTooltip title="Add a prefix / suffix to all types of the remote schema" />
          </div>

          <FormInput
            control={control}
            name="definition.customization.type_prefix"
            label="Prefix"
            placeholder="prefix_"
            autoComplete="off"
          />

          <FormInput
            control={control}
            name="definition.customization.type_suffix"
            label="Suffix"
            placeholder="_suffix"
            autoComplete="off"
          />
        </div>

        <div className="space-y-3">
          <div className="flex flex-row items-center space-x-2">
            <h4 className="font-semibold text-lg">Fields</h4>
            <InfoTooltip title="Add a prefix / suffix to the fields of the query / mutation root fields" />
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">Query root</h4>
            {queryRootError?.message && (
              <p className="text-destructive text-sm">
                {queryRootError.message}
              </p>
            )}

            <FormInput
              control={control}
              name="definition.customization.query_root.parent_type"
              label="Type Name"
              placeholder="Query/query_root"
              autoComplete="off"
            />

            <FormInput
              control={control}
              name="definition.customization.query_root.prefix"
              label="Prefix"
              placeholder="prefix_"
              autoComplete="off"
            />

            <FormInput
              control={control}
              name="definition.customization.query_root.suffix"
              label="Suffix"
              placeholder="_suffix"
              autoComplete="off"
            />
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">Mutation root</h4>
            {mutationRootError?.message && (
              <p className="text-destructive text-sm">
                {mutationRootError.message}
              </p>
            )}

            <FormInput
              control={control}
              name="definition.customization.mutation_root.parent_type"
              label="Type Name"
              placeholder="Mutation/mutation_root"
              autoComplete="off"
            />

            <FormInput
              control={control}
              name="definition.customization.mutation_root.prefix"
              label="Prefix"
              placeholder="prefix_"
              autoComplete="off"
            />

            <FormInput
              control={control}
              name="definition.customization.mutation_root.suffix"
              label="Suffix"
              placeholder="_suffix"
              autoComplete="off"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
