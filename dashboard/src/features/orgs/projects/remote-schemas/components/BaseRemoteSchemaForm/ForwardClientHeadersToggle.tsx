import { InfoIcon } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { FormSwitch } from '@/components/form/FormSwitch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { BaseRemoteSchemaFormValues } from './BaseRemoteSchemaForm';

export default function ForwardClientHeadersToggle() {
  const { control } = useFormContext<BaseRemoteSchemaFormValues>();

  return (
    <FormSwitch
      control={control}
      name="definition.forward_client_headers"
      containerClassName="flex flex-row items-center justify-between gap-2 space-y-0"
      label={
        <span className="flex flex-row items-center gap-2">
          Forward all headers from client
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
              Toggle forwarding headers sent by the client app in the request to
              your remote GraphQL server
            </TooltipContent>
          </Tooltip>
        </span>
      }
    />
  );
}
