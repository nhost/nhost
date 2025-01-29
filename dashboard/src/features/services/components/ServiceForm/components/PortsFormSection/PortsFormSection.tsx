import { ControlledSwitch } from '@/components/form/ControlledSwitch';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { InfoCard } from '@/features/projects/overview/components/InfoCard';
import { PortTypes } from '@/features/services/components/ServiceForm/components/PortsFormSection/PortsFormSectionTypes';
import { type ServiceFormValues } from '@/features/services/components/ServiceForm/ServiceFormTypes';
import { getRunServicePortURL } from '@/utils/helpers';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';

export default function PortsFormSection() {
  const form = useFormContext<ServiceFormValues>();

  const { currentProject } = useCurrentWorkspaceAndProject();

  const {
    register,
    setValue,
    formState: { errors },
  } = form;

  const { fields, append, remove } = useFieldArray({
    name: 'ports',
  });

  const formValues = useWatch<ServiceFormValues & { subdomain: string }>();

  const onChangePortType = (value: string | undefined, index: number) =>
    setValue(`ports.${index}.type`, value as PortTypes);

  const showURL = (index: number) =>
    formValues.subdomain &&
    (formValues.ports[index]?.type === PortTypes.HTTP ||
      formValues.ports[index]?.type === PortTypes.GRPC) &&
    formValues.ports[index]?.publish;

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
                  href="https://docs.nhost.io/run/networking"
                  className="underline"
                >
                  Networking
                </a>{' '}
                for more information.
              </span>
            }
          >
            <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
          </Tooltip>
        </Box>
        <Button
          variant="borderless"
          onClick={() => append({ port: null, type: null, publish: false })}
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </Box>

      <Box className="flex flex-col space-y-4">
        {fields.map((field, index) => (
          <Box key={field.id} className="flex flex-col space-y-2">
            <Box className="flex w-full flex-col space-y-2 xs+:flex-row xs+:space-x-2 xs+:space-y-0">
              <Input
                {...register(`ports.${index}.port`)}
                id={`${field.id}-port`}
                placeholder="Port"
                className="w-full"
                hideEmptyHelperText
                error={!!errors?.ports?.at(index)}
                helperText={errors?.ports?.at(index)?.message}
                fullWidth
                autoComplete="off"
              />

              <Select
                fullWidth
                value={formValues.ports.at(index)?.type || ''}
                onChange={(_event, inputValue) =>
                  onChangePortType(inputValue as string, index)
                }
                placeholder="Select port type"
                slotProps={{
                  listbox: { className: 'min-w-0 w-full' },
                  popper: {
                    disablePortal: false,
                    className: 'z-[10000] w-[270px]',
                  },
                }}
              >
                {['http', 'tcp', 'udp', 'grpc']?.map((portType) => (
                  <Option key={portType} value={portType}>
                    {portType}
                  </Option>
                ))}
              </Select>

              <ControlledSwitch
                {...register(`ports.${index}.publish`)}
                disabled={false} // TODO turn off and disable if the port is not http
                label={
                  <Text variant="subtitle1" component="span">
                    Publish
                  </Text>
                }
              />
              <Button
                variant="borderless"
                className=""
                color="error"
                onClick={() => remove(index)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </Box>

            {showURL(index) && (
              <InfoCard
                title="URL"
                value={getRunServicePortURL(
                  formValues?.subdomain,
                  currentProject?.region.name,
                  currentProject?.region.domain,
                  formValues.ports[index],
                )}
              />
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
