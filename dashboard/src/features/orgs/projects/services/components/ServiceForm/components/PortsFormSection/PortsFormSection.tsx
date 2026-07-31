import { CopyIcon, PlusIcon, Trash2 as TrashIcon } from 'lucide-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { Label } from '@/components/ui/v3/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { Switch } from '@/components/ui/v3/switch';
import { TextLink } from '@/components/ui/v3/text-link';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  isPublishablePortType,
  type PortTypes,
} from '@/features/orgs/projects/services/components/ServiceForm/components/PortsFormSection/PortsFormSectionTypes';
import type { ServiceFormValues } from '@/features/orgs/projects/services/components/ServiceForm/ServiceFormTypes';
import type { ConfigRunServicePort } from '@/generated/graphql';
import { cn, isNotEmptyValue } from '@/lib/utils';
import { copy } from '@/utils/copy';
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
    setValue(`ports.${index}.type`, value as PortTypes, { shouldDirty: true });
    if (!isPublishablePortType(value)) {
      setValue(`ports.${index}.publish`, false, { shouldDirty: true });
    }
  };

  const showURL = (index: number) =>
    isNotEmptyValue(formValues.subdomain) &&
    isNotEmptyValue(project) &&
    isPublishablePortType(formValues.ports?.[index]?.type) &&
    formValues.ports?.[index]?.publish;

  return (
    <div className="space-y-4 rounded border-1 p-4">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center space-x-2">
          <h4 className="font-semibold">Ports</h4>
          <InfoTooltip>
            Network ports to configure for the service. Refer to{' '}
            <TextLink
              href="https://docs.nhost.io/products/run/networking"
              external
              className="font-medium"
            >
              Networking
            </TextLink>{' '}
            for more information.
          </InfoTooltip>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Add port"
          onClick={() => append({ port: null, type: null, publish: false })}
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-col space-y-4">
        {fields.map((field, index) => {
          const portError = errors.ports?.[index];
          const errorMessage =
            portError?.port?.message ?? portError?.type?.message;
          const url = showURL(index)
            ? getRunServicePortURL(
                formValues.subdomain!,
                project!.region.name!,
                project!.region.domain!,
                formValues.ports![index] as ConfigRunServicePort,
              )
            : null;

          return (
            <div key={field.id} className="flex flex-col space-y-2">
              <div className="flex w-full xs+:flex-row flex-col xs+:space-x-2 space-y-2 xs+:space-y-0">
                <div className="w-full space-y-1">
                  <Input
                    {...register(`ports.${index}.port`)}
                    id={`${field.id}-port`}
                    type="number"
                    placeholder="Port"
                    className={cn({ 'border-destructive': errorMessage })}
                    aria-invalid={!!errorMessage}
                    autoComplete="off"
                  />
                  {errorMessage && (
                    <p className="text-destructive text-sm">{errorMessage}</p>
                  )}
                </div>

                <Select
                  value={formValues.ports?.[index]?.type || ''}
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

                <div className="flex items-center gap-2">
                  <Switch
                    id={`${field.id}-publish`}
                    checked={!!formValues.ports?.[index]?.publish}
                    onCheckedChange={(checked) =>
                      setValue(`ports.${index}.publish`, checked, {
                        shouldDirty: true,
                      })
                    }
                    disabled={
                      !isPublishablePortType(formValues.ports?.[index]?.type)
                    }
                  />
                  <Label htmlFor={`${field.id}-publish`}>Publish</Label>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  aria-label="Remove port"
                  onClick={() => remove(index)}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>

              {url && (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-muted p-3">
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-xs">URL</p>
                    <p className="truncate font-mono text-sm">{url}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Copy URL"
                    onClick={() => copy(url, 'URL')}
                  >
                    <CopyIcon className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
