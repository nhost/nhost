import { InfoIcon } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { DEFAULT_REMOTE_SCHEMA_TIMEOUT_SECONDS } from '@/features/orgs/projects/remote-schemas/utils/constants';
import type { BaseRemoteSchemaFormValues } from './BaseRemoteSchemaForm';

export default function GraphQLServerTimeoutInput() {
  const { control } = useFormContext<BaseRemoteSchemaFormValues>();

  return (
    <FormInput
      control={control}
      name="definition.timeout_seconds"
      label={
        <span className="flex flex-row items-center gap-2">
          GraphQL Server Timeout
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
              Configure timeout for your remote GraphQL server.
            </TooltipContent>
          </Tooltip>
        </span>
      }
      placeholder={DEFAULT_REMOTE_SCHEMA_TIMEOUT_SECONDS.toString()}
      autoComplete="off"
      addonEnd={<span className="text-muted-foreground">seconds</span>}
    />
  );
}
