import { InfoIcon, PlusIcon, Trash2 as TrashIcon } from 'lucide-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import { Button } from '@/components/ui/v3/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { ContactPointsFormValues } from '@/features/orgs/projects/metrics/settings/components/ContactPointsSettings/ContactPointsSettingsTypes';
import { HttpMethod } from './WebhookFormSectionTypes';

export default function WebhookFormSection() {
  const { setValue, control } = useFormContext<ContactPointsFormValues>();
  const formValues = useWatch<ContactPointsFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'webhook',
  });

  const onChangeHttpMethod = (value: string | undefined, index: number) =>
    setValue(`webhook.${index}.httpMethod`, value as HttpMethod);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center space-x-2">
          <h3 className="font-semibold">Webhook</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoIcon aria-label="Info" className="h-4 w-4 text-primary" />
            </TooltipTrigger>
            <TooltipContent>
              <span>
                Send information about a state change to an external service
                over HTTP.
              </span>
            </TooltipContent>
          </Tooltip>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Add webhook"
          onClick={() =>
            append({
              url: '',
              httpMethod: HttpMethod.POST,
              username: '',
              password: '',
              authorizationScheme: '',
              authorizationCredentials: '',
              maxAlerts: 0,
            })
          }
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </div>

      {fields?.length > 0 ? (
        <div className="flex flex-col gap-12">
          {fields.map((field, index) => (
            <div key={field.id} className="flex w-full items-center space-x-2">
              <div className="grid flex-grow gap-4 lg:grid-cols-9">
                <FormInput
                  control={control}
                  name={`webhook.${index}.url`}
                  label="URL"
                  placeholder="Enter URL"
                  containerClassName="w-full lg:col-span-7"
                  autoComplete="off"
                />

                <div className="grid gap-1 lg:col-span-2">
                  <label
                    htmlFor={`${field.id}-httpMethod`}
                    className="font-medium text-sm+"
                  >
                    HTTP Method
                  </label>
                  <Select
                    value={formValues.webhook?.at(index)?.httpMethod || ''}
                    onValueChange={(value) => onChangeHttpMethod(value, index)}
                  >
                    <SelectTrigger id={`${field.id}-httpMethod`}>
                      <SelectValue placeholder="Select HTTP Method" />
                    </SelectTrigger>
                    <SelectContent className="z-[10000] w-[270px] min-w-0">
                      {Object.values(HttpMethod).map((httpMethod) => (
                        <SelectItem key={httpMethod} value={httpMethod}>
                          {httpMethod}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <FormInput
                  control={control}
                  name={`webhook.${index}.username`}
                  label="Username"
                  placeholder="Enter username"
                  containerClassName="w-full lg:col-span-3"
                  autoComplete="off"
                />

                <FormInput
                  control={control}
                  name={`webhook.${index}.password`}
                  label="Password"
                  placeholder="Enter password"
                  type="password"
                  containerClassName="w-full lg:col-span-4"
                  autoComplete="off"
                />
                <FormInput
                  control={control}
                  name={`webhook.${index}.maxAlerts`}
                  label="Max Alerts (0 means no limit)"
                  placeholder="Enter max alerts"
                  type="number"
                  containerClassName="w-full lg:col-span-2"
                  autoComplete="off"
                />

                <FormInput
                  control={control}
                  name={`webhook.${index}.authorizationScheme`}
                  label="Authorization Scheme"
                  placeholder="Enter authorization scheme"
                  containerClassName="w-full lg:col-span-3"
                  autoComplete="off"
                />
                <FormInput
                  control={control}
                  name={`webhook.${index}.authorizationCredentials`}
                  label="Authorization Credentials"
                  placeholder="Enter authorization credentials"
                  containerClassName="w-full lg:col-span-6"
                  autoComplete="off"
                />
              </div>

              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                aria-label="Remove webhook"
                onClick={() => remove(index)}
              >
                <TrashIcon className="h-6 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
