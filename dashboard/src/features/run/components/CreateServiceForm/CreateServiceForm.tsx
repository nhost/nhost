import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { Alert } from '@/components/ui/v2/Alert';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import {
  MAX_SERVICE_MEMORY,
  MAX_SERVICE_REPLICAS,
  MAX_SERVICE_VCPU,
  MAX_STORAGE_CAPACITY,
  MIN_SERVICE_MEMORY,
  MIN_SERVICE_VCPU,
  MIN_STORAGE_CAPACITY,
} from '@/features/projects/resources/settings/utils/resourceSettingsValidationSchema';
import { ComputeFormSection } from '@/features/run/components/ComputeFormSection';
import { EnvironmentFormSection } from '@/features/run/components/EnvironmentFormSection';
import { PortsFormSection } from '@/features/run/components/PortsFormSection';
import { StorageFormSection } from '@/features/run/components/StorageFormSection';
import type { DialogFormProps } from '@/types/common';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { ReplicasFormSection } from '../ReplicasFormSection';

export interface CreateServiceFormProps extends DialogFormProps {
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
  /**
   * Function to be called when the submit is successful.
   */
  onSubmit?: VoidFunction | ((args?: any) => Promise<any>);
}

const EnvironementVariableSchema = Yup.object().shape({
  name: Yup.string().required(),
  value: Yup.string().required(),
});

const StorageSchema = Yup.object().shape({
  name: Yup.string().required(),
  capacity: Yup.number()
    .min(MIN_STORAGE_CAPACITY)
    .max(MAX_STORAGE_CAPACITY)
    .required(),
  path: Yup.string().required(),
});

enum PortTypes {
  HTTP = 'http',
  TCP = 'tcp',
  UDP = 'udp',
}

const PortSchema = Yup.object().shape({
  port: Yup.number().required(),
  type: Yup.mixed<PortTypes>().oneOf(Object.values(PortTypes)).required(),
  publish: Yup.boolean().default(false),
});

export const validationSchema = Yup.object({
  name: Yup.string().required('The name is required.'),
  image: Yup.string().label('Image to run').required('The image is required.'),
  environment: Yup.array().of(EnvironementVariableSchema),
  compute: Yup.object({
    cpu: Yup.number().min(MIN_SERVICE_VCPU).max(MAX_SERVICE_VCPU).required(),
    memory: Yup.number()
      .min(MIN_SERVICE_MEMORY)
      .max(MAX_SERVICE_MEMORY)
      .required(),
  }),
  replicas: Yup.number().min(1).max(MAX_SERVICE_REPLICAS).required(),
  ports: Yup.array().of(PortSchema),
  storage: Yup.array().of(StorageSchema),
});

export type CreateServiceFormValues = Yup.InferType<typeof validationSchema>;

export default function CreateServiceForm({
  onSubmit,
  onCancel,
  location,
}: CreateServiceFormProps) {
  const { onDirtyStateChange } = useDialog();
  // const { currentProject } = useCurrentWorkspaceAndProject();
  const [createServiceFormError, setCreateServiceFormError] =
    useState<Error | null>(null);

  const form = useForm<CreateServiceFormValues>({
    defaultValues: {
      compute: {
        cpu: 62,
        memory: 128,
      },
      replicas: 1,
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  const {
    register,
    // control,
    watch,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
    // setError,
  } = form;

  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  async function handleCreateService(values: CreateServiceFormValues) {
    setCreateServiceFormError(null);

    try {
      console.log({ values });

      onSubmit?.();
    } catch (error) {
      // Note: The error is already handled by the toast promise.
    }
  }

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleCreateService}
        className="grid grid-flow-row gap-4 px-6 pb-6"
      >
        <Input
          {...register('name')}
          id="name"
          label="Name"
          placeholder="Service name"
          hideEmptyHelperText
          error={!!errors.name}
          helperText={errors?.name?.message}
          fullWidth
          autoComplete="off"
          autoFocus
        />

        <Input
          {...register('image')}
          id="image"
          label="Image"
          placeholder="Image to run"
          hideEmptyHelperText
          error={!!errors.image}
          helperText={errors?.image?.message}
          fullWidth
          autoComplete="off"
        />

        <EnvironmentFormSection />

        <ComputeFormSection />

        <PortsFormSection />

        <StorageFormSection />

        <ReplicasFormSection />

        {createServiceFormError && (
          <Alert
            severity="error"
            className="grid grid-flow-col items-center justify-between px-4 py-3"
          >
            <span className="text-left">
              <strong>Error:</strong> {createServiceFormError.message}
            </span>

            <Button
              variant="borderless"
              color="error"
              size="small"
              onClick={() => {
                setCreateServiceFormError(null);
              }}
            >
              Clear
            </Button>
          </Alert>
        )}
        <div className="grid grid-flow-row gap-2">
          <Button type="submit" disabled={isSubmitting}>
            Create
          </Button>

          <Button variant="outlined" color="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}
