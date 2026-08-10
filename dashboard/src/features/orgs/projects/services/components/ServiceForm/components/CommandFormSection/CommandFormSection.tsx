import debounce from 'lodash.debounce';
import { InfoIcon, PlusIcon, Trash2 as TrashIcon } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Alert } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { ServiceFormValues } from '@/features/orgs/projects/services/components/ServiceForm/ServiceFormTypes';
import { cn } from '@/lib/utils';

function CommandTooltip() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label="Info" className="flex">
          <InfoIcon className="h-4 w-4 text-primary" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">
        <div className="flex flex-col gap-2">
          <p>Specify the command and its arguments to run the service.</p>
          <p>
            Note that the command and/or its parameters need to be specified on
            different lines.
          </p>
          <p>For instance:</p>
          <ul className="list-inside list-['-_']">
            <li>node</li>
            <li>server.js</li>
            <li>--port=3000</li>
          </ul>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default function CommandFormSection() {
  const {
    register,
    formState: { errors },
    control,
    watch,
    setValue,
  } = useFormContext<ServiceFormValues>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'command',
  });

  // Watch for spaces
  const commandValues = watch('command');

  const handleCommandChange = debounce((value: string, index: number) => {
    setValue(`command.${index}.argument`, value);
  }, 500);

  const hasSpaceInCommand = commandValues?.some((field) => {
    // Omit any content within curly brackets
    const withoutBrackets = field.argument.replace(/\{\{.*?\}\}/g, '');
    return withoutBrackets.includes(' ');
  });

  return (
    <div className="space-y-4 rounded border-1 p-4">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center space-x-2">
          <h4 className="font-semibold">Command</h4>
          <CommandTooltip />
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Add command argument"
          onClick={() => append({ argument: '' })}
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-col space-y-4">
        {fields.map((field, index) => {
          const errorMessage = errors.command?.[index]?.argument?.message;

          return (
            <div key={field.id} className="flex w-full items-start space-x-2">
              <div className="w-full space-y-1">
                <Input
                  {...register(`command.${index}.argument`)}
                  onChange={(event) =>
                    handleCommandChange(event.target.value, index)
                  }
                  id={`command-${index}`}
                  placeholder={index === 0 ? 'mycmd' : '--myflag'}
                  className={cn({ 'border-destructive': errorMessage })}
                  aria-invalid={!!errorMessage}
                  autoComplete="off"
                />
                {errorMessage && (
                  <p className="text-destructive text-sm">{errorMessage}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                aria-label="Remove command argument"
                onClick={() => remove(index)}
              >
                <TrashIcon className="h-6 w-4" />
              </Button>
            </div>
          );
        })}
        {hasSpaceInCommand && (
          <Alert variant="warning" className="flex flex-col gap-3 text-left">
            <div className="flex flex-col gap-2 lg:flex-row lg:justify-between">
              <p className="flex items-start gap-1 font-semibold">
                <span>⚠</span> Warning: Space in command
              </p>
            </div>
            <div>
              <p>
                A space was detected, make sure it is intended, check the
                tooltip for details
              </p>
            </div>
          </Alert>
        )}
      </div>
    </div>
  );
}
