import { InfoIcon } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { BaseRemoteSchemaFormValues } from './BaseRemoteSchemaForm';

export default function RemoteSchemaCommentInput() {
  const { control } = useFormContext<BaseRemoteSchemaFormValues>();

  return (
    <FormInput
      control={control}
      name="comment"
      label={
        <span className="flex flex-row items-center gap-2">
          Comment
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
              A statement to help describe the remote schema in brief.
            </TooltipContent>
          </Tooltip>
        </span>
      }
      placeholder="Comment, e.g. 'Remote schema for the Graphite API'"
      autoComplete="off"
    />
  );
}
