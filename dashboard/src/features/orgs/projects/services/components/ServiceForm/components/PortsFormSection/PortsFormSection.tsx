import { InfoIcon, PlusIcon, Trash2 as TrashIcon } from 'lucide-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { ControlledSwitch } from '@/components/form/ControlledSwitch';
import { Box } from '@/components/ui/v2/Box';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { Button } from '@/components/ui/v3/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { InfoCard } from '@/features/orgs/projects/overview/components/InfoCard';
import {
  isPublishablePortType,
  type PortTypes,
} from '@/features/orgs/projects/services/components/ServiceForm/components/PortsFormSection/PortsFormSectionTypes';
import type { ServiceFormValues } from '@/features/orgs/projects/services/components/ServiceForm/ServiceFormTypes';
import { isNotEmptyValue } from '@/lib/utils';
import type { ConfigRunServicePort } from '@/utils/__generated__/graphql';
import { getRunServicePortURL } from '@/utils/helpers';

export default function PortsFormSection() {
  const form = useFormContext<ServiceFormValues>();

  const { project } = useProject();

  const {
    register,
    setValue,
    formState: { errors },
  } = form;

  const { fields, append, remove } = useFieldArray({
    name: 'ports',
  });

  const formValues = useWatch<ServiceFormValues & { subdomain: string }>();

  const onChangePortType = (value: string | undefined, index: number) => {
    setValue(`ports.${index}.type`, value as PortTypes);
    if (!isPublishablePortType(value)) {
      setValue(`ports.${index}.publish`, false);
    }
  };

  const showURL = (index: number) =>
    isNotEmptyValue(formValues.subdomain) &&
    isNotEmptyValue(project) &&
    isPublishablePortType(formValues.ports?.[index]?.type) &&
    formValues.ports?.[index]?.publish;

  return (
    <Box className="space-y-4 rounded border-1 p-4">
      <Box className="flex flex-row items-center justify-between">
        <Box className="flex flex-row items-center space-x-2">
          <Text variant="h4" className="font-semibold">
            Ports
          </Text>
          <Tooltip
            title={
              <span>
                Network ports to configure for the service. Refer to{' '}
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://docs.nhost.io/products/run/networking"
                  className="underline"
                >
                  Networking
                </a>{' '}
                for more information.
              </span>
            }
          >
            <InfoIcon aria-label="Info" className="h-4 w-4 text-primary" />
          </Tooltip>
        </Box>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Add port"
          onClick={() => append({ port: null, type: null, publish: false })}
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </Box>

      <Box className="flex flex-col space-y-4">
        {fields.map((field, index) => (
          <Box key={field.id} className="flex flex-col space-y-2">
            <Box className="flex w-full xs+:flex-row flex-col xs+:space-x-2 space-y-2 xs+:space-y-0">
              <Input
                {...register(`ports.${index}.port`)}
                id={`${field.id}-port`}
                placeholder="Port"
                className="w-full"
                hideEmptyHelperText
                error={!!errors?.ports?.at?.(index)}
                helperText={errors?.ports?.at?.(index)?.message}
                fullWidth
                autoComplete="off"
              />

              <Select
                value={formValues.ports?.at?.(index)?.type || ''}
                onValueChange={(value) => onChangePortType(value, index)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select port type" />
                </SelectTrigger>
                <SelectContent className="z-[10000] w-[270px] min-w-0">
                  {['http', 'tcp', 'udp', 'grpc']?.map((portType) => (
                    <SelectItem key={portType} value={portType}>
                      {portType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <ControlledSwitch
                {...register(`ports.${index}.publish`)}
                disabled={
                  !isPublishablePortType(formValues.ports?.at?.(index)?.type)
                }
                label={
                  <Text variant="subtitle1" component="span">
                    Publish
                  </Text>
                }
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                aria-label="Remove port"
                onClick={() => remove(index)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </Box>

            {/* project and formValues are present */}
            {showURL(index) && (
              <InfoCard
                title="URL"
                value={getRunServicePortURL(
                  formValues.subdomain!,
                  project!.region.name!,
                  project!.region.domain!,
                  formValues.ports![index] as ConfigRunServicePort,
                )}
              />
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
