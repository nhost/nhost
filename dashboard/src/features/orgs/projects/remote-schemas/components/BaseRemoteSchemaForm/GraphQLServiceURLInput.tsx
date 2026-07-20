import { InfoIcon } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { BaseRemoteSchemaFormValues } from './BaseRemoteSchemaForm';

export default function GraphQLServiceURLInput() {
  const { control } = useFormContext<BaseRemoteSchemaFormValues>();

  return (
    <FormInput
      control={control}
      name="definition.url"
      label={
        <span className="flex flex-row items-center gap-2">
          GraphQL Service URL
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Info"
                className="flex items-center"
              >
                <InfoIcon className="h-4 w-4 text-primary" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              The URL of the GraphQL service to be used as a remote schema.
              Environment variables and secrets are available using the
              {' {{VARIABLE}} '}
              tag. Example: https://{'{{ENV_VAR}}'}/endpoint_url.
            </TooltipContent>
          </Tooltip>
        </span>
      }
      placeholder="https://graphql-service.example.com or {{ENV_VAR}}/endpoint_url"
      autoComplete="off"
    />
  );
}
