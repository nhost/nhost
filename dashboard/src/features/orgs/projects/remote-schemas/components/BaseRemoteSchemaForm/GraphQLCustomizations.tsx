import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import type { BaseRemoteSchemaFormValues } from './BaseRemoteSchemaForm';

export default function GraphQLCustomizations() {
  const [isOpen, setIsOpen] = useState(false);
  const { register, getFieldState, formState } =
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
      <Box className="space-y-4">
        <Box className="flex h-8 flex-row items-center justify-between">
          <Text variant="h4" className="text-lg font-semibold">
            GraphQL Customizations
          </Text>
        </Box>
        <Text variant="body2" color="secondary" className="text-sm">
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
        </Text>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          startIcon={<PlusIcon />}
          onClick={() => setIsOpen(true)}
          className="mt-2"
        >
          Add GQL Customization
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

      <Text variant="body2" color="secondary" className="text-sm">
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
      </Text>

      <Box className="space-y-4 rounded border p-4">
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
              {...register('definition.customization.type_prefix')}
              id="definition.customization.type_prefix"
              name="definition.customization.type_prefix"
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
              {...register('definition.customization.type_suffix')}
              id="definition.customization.type_suffix"
              name="definition.customization.type_suffix"
              placeholder="_suffix"
              hideEmptyHelperText
              autoComplete="off"
              variant="inline"
              fullWidth
            />
          </Box>
        </Box>

        <Box className="space-y-3">
          <Box className="flex flex-row items-center space-x-2">
            <Text variant="h4" className="text-lg font-semibold">
              Fields
            </Text>
            <Tooltip title="Add a prefix / suffix to the fields of the query / mutation root fields">
              <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
            </Tooltip>
          </Box>

          <Box className="space-y-3">
            <Text variant="h4" className="font-semibold">
              Query root
            </Text>
            {queryRootError?.message && (
              <Text color="error" className="text-sm">
                {queryRootError.message}
              </Text>
            )}

            <Box className="space-y-2">
              <Text className="font-medium">Type Name</Text>
              <Input
                {...register('definition.customization.query_root.parent_type')}
                id="definition.customization.query_root.parent_type"
                name="definition.customization.query_root.parent_type"
                placeholder="Query/query_root"
                hideEmptyHelperText
                autoComplete="off"
                variant="inline"
                fullWidth
              />
            </Box>

            <Box className="space-y-2">
              <Text className="font-medium">Prefix</Text>
              <Input
                {...register('definition.customization.query_root.prefix')}
                id="definition.customization.query_root.prefix"
                name="definition.customization.query_root.prefix"
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
                {...register('definition.customization.query_root.suffix')}
                id="definition.customization.query_root.suffix"
                name="definition.customization.query_root.suffix"
                placeholder="_suffix"
                hideEmptyHelperText
                autoComplete="off"
                variant="inline"
                fullWidth
              />
            </Box>
          </Box>

          <Box className="space-y-3">
            <Text variant="h4" className="font-semibold">
              Mutation root
            </Text>
            {mutationRootError?.message && (
              <Text color="error" className="text-sm">
                {mutationRootError.message}
              </Text>
            )}

            <Box className="space-y-2">
              <Text className="font-medium">Type Name</Text>
              <Input
                {...register(
                  'definition.customization.mutation_root.parent_type',
                )}
                id="definition.customization.mutation_root.parent_type"
                name="definition.customization.mutation_root.parent_type"
                placeholder="Mutation/mutation_root"
                hideEmptyHelperText
                autoComplete="off"
                variant="inline"
                fullWidth
              />
            </Box>

            <Box className="space-y-2">
              <Text className="font-medium">Prefix</Text>
              <Input
                {...register('definition.customization.mutation_root.prefix')}
                id="definition.customization.mutation_root.prefix"
                name="definition.customization.mutation_root.prefix"
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
                {...register('definition.customization.mutation_root.suffix')}
                id="definition.customization.mutation_root.suffix"
                name="definition.customization.mutation_root.suffix"
                placeholder="_suffix"
                hideEmptyHelperText
                autoComplete="off"
                variant="inline"
                fullWidth
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
