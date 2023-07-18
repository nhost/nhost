import { ControlledSwitch } from '@/components/form/ControlledSwitch';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Input } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { InfoCard } from '@/features/projects/overview/components/InfoCard';
import {
  PortTypes,
  type CreateServiceFormValues,
} from '@/features/services/components/CreateServiceForm';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useUpdateRunServiceConfigMutation } from '@/utils/__generated__/graphql';
import type { ApolloError } from '@apollo/client';
import { useRouter } from 'next/router';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

interface EditServicePortsFormValues
  extends Required<Pick<CreateServiceFormValues, 'ports' | 'name'>> {}
interface EditServicePortsProps extends EditServicePortsFormValues {}

export default function EditServicePorts({
  ports,
  name,
}: EditServicePortsProps) {
  const {
    query: { serviceId },
  } = useRouter();

  const { currentProject } = useCurrentWorkspaceAndProject();

  const form = useForm<EditServicePortsFormValues>({
    defaultValues: {
      ports,
    },
  });

  const [updateRunServiceConfig] = useUpdateRunServiceConfigMutation();

  const { reset, watch, control, register, setValue, formState } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'ports',
  });

  const portsFormValue = watch('ports');

  const onChangePortType = (value: string | undefined, index: number) =>
    setValue(`ports.${index}.type`, value as PortTypes);

  const showURL = (index: number) =>
    portsFormValue[index]?.type === PortTypes.HTTP &&
    portsFormValue[index]?.publish;

  const handlePortsChanged = async (values: EditServicePortsFormValues) => {
    try {
      await toast.promise(
        updateRunServiceConfig({
          variables: {
            appID: currentProject.id,
            serviceID: serviceId,
            config: {
              ports: values.ports.map((item) => ({
                port: Number(item.port),
                type: item.type,
                publish: item.publish,
              })),
            },
          },
        }),
        {
          loading: 'Updating...',
          success: () => {
            // Reset the form state to disable the save button
            reset({}, { keepValues: true });
            return 'The service has been updated successfully.';
          },
          error: (arg: ApolloError) => {
            // we need to get the internal error message from the GraphQL error
            const { internal } = arg.graphQLErrors[0]?.extensions || {};
            const { message } = (internal as Record<string, any>)?.error || {};

            // we use the default Apollo error message if we can't find the
            // internal error message
            return (
              message ||
              arg.message ||
              'An error occurred while updating the service. Please try again.'
            );
          },
        },
        getToastStyleProps(),
      );
    } catch {
      // Note the error is handled by the toast
    }
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handlePortsChanged}>
        <SettingsContainer
          title="Ports"
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty,
              loading: formState.isSubmitting,
            },
          }}
        >
          <Box className="grid w-full place-content-end">
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
                <Box className="flex w-full flex-row space-x-2">
                  <Input
                    {...register(`ports.${index}.port`)}
                    id={`${field.id}-port`}
                    placeholder="Port"
                    className="w-full"
                    hideEmptyHelperText
                    error={!!formState.errors?.ports?.at(index)}
                    helperText={formState.errors?.ports?.at(index)?.message}
                    fullWidth
                    autoComplete="off"
                  />
                  <Select
                    fullWidth
                    value={portsFormValue[index].type}
                    onChange={(_event, inputValue) =>
                      onChangePortType(inputValue as string, index)
                    }
                    placeholder="Select port type"
                    slotProps={{
                      listbox: { className: 'min-w-0 w-full' },
                      popper: {
                        disablePortal: false,
                        className: 'z-[10000] w-[270px] w-full',
                      },
                    }}
                  >
                    {['http', 'tcp', 'udp']?.map((portType) => (
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
                    value={`https://${currentProject.subdomain}-${name}-${portsFormValue[index]?.port}.svc.${currentProject.region.awsName}.${currentProject.region.domain}`}
                  />
                )}
              </Box>
            ))}
          </Box>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
