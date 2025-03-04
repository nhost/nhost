import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import type { ServiceFormValues } from '@/features/orgs/projects/services/components/ServiceForm/ServiceFormTypes';
import { useFieldArray, useFormContext } from 'react-hook-form';

function CommandTooltip() {
  return (
    <Tooltip
      title={
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
      }
    >
      <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
    </Tooltip>
  );
}

export default function CommandFormSection() {
  const {
    register,
    formState: { errors },
    control,
    watch,
  } = useFormContext<ServiceFormValues>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'command',
  });

  // Watch for spaces
  const commandValues = watch('command');

  const hasSpaceInCommand = commandValues?.some((field) => {
    // Omit any content within curly brackets
    const withoutBrackets = field.argument.replace(/\{\{.*?\}\}/g, '');
    return withoutBrackets.includes(' ');
  });

  return (
    <Box className="space-y-4 rounded border-1 p-4">
      <Box className="flex flex-row items-center justify-between">
        <Box className="flex flex-row items-center space-x-2">
          <Text variant="h4" className="font-semibold">
            Command
          </Text>
          <CommandTooltip />
        </Box>
        <Button variant="borderless" onClick={() => append({ argument: '' })}>
          <PlusIcon className="h-5 w-5" />
        </Button>
      </Box>

      <Box className="flex flex-col space-y-4">
        {fields.map((field, index) => (
          <Box key={field.id} className="flex w-full items-center space-x-2">
            <Input
              {...register(`command.${index}.argument`)}
              id={`command-${index}`}
              placeholder={index === 0 ? 'mycmd' : '--myflag'}
              className="w-full"
              hideEmptyHelperText
              error={!!errors.command?.[index]}
              helperText={errors.command?.[index]?.message}
              fullWidth
              autoComplete="off"
            />
            <Button
              variant="borderless"
              color="error"
              onClick={() => remove(index)}
            >
              <TrashIcon className="h-6 w-4" />
            </Button>
          </Box>
        ))}
        {hasSpaceInCommand && (
          <Alert severity="warning" className="flex flex-col gap-3 text-left">
            <div className="flex flex-col gap-2 lg:flex-row lg:justify-between">
              <Text className="flex items-start gap-1 font-semibold">
                <span>⚠</span> Warning: Space in command
              </Text>
            </div>
            <div>
              <Text>
                A space was detected, make sure it is intended, check the
                tooltip for details
              </Text>
            </div>
          </Alert>
        )}
      </Box>
    </Box>
  );
}
