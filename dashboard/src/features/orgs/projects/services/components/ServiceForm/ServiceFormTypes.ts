import { PortTypes } from '@/features/orgs/projects/services/components/ServiceForm/components/PortsFormSection/PortsFormSectionTypes';
import type { DialogFormProps } from '@/types/common';
import * as Yup from 'yup';

import {
  MAX_SERVICES_CPU,
  MAX_SERVICES_MEM,
  MAX_SERVICE_REPLICAS,
  MIN_SERVICES_CPU,
  MIN_SERVICES_MEM,
} from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';

export const validationSchema = Yup.object({
  name: Yup.string().required('The name is required.'),
  image: Yup.string()
    .trim()
    .label('Image to run')
    .required('The image is required.')
    .min(1, 'Image must be at least 1 character long'),
  pullCredentials: Yup.string().label('Pull credentials').nullable(),
  command: Yup.array().of(
    Yup.object().shape({
      argument: Yup.string().required(),
    }),
  ),
  environment: Yup.array().of(
    Yup.object().shape({
      name: Yup.string().required(),
      value: Yup.string().required(),
    }),
  ),
  compute: Yup.object({
    cpu: Yup.number().min(MIN_SERVICES_CPU).max(MAX_SERVICES_CPU).required(),
    memory: Yup.number().min(MIN_SERVICES_MEM).max(MAX_SERVICES_MEM).required(),
  }),
  replicas: Yup.number().min(0).max(MAX_SERVICE_REPLICAS).required(),
  autoscaler: Yup.object()
    .shape({
      maxReplicas: Yup.number().min(0).max(MAX_SERVICE_REPLICAS),
    })
    .nullable()
    .default(null),
  ports: Yup.array().of(
    Yup.object().shape({
      port: Yup.number().required(),
      type: Yup.mixed<PortTypes>().oneOf(Object.values(PortTypes)).required(),
      publish: Yup.boolean().default(false),
      ingresses: Yup.array()
        .of(
          Yup.object().shape({
            fqdn: Yup.array().of(Yup.string()),
          }),
        )
        .nullable(),
    }),
  ),
  storage: Yup.array().of(
    Yup.object()
      .shape({
        name: Yup.string().required(),
        path: Yup.string().required(),
        capacity: Yup.number().nonNullable().required(),
      })
      .required(),
  ),
  healthCheck: Yup.object()
    .shape({
      port: Yup.number().required(),
      initialDelaySeconds: Yup.number().required(),
      probePeriodSeconds: Yup.number().required(),
    })
    .optional()
    .nullable()
    .default(undefined),
});

export type ServiceFormValues = Yup.InferType<typeof validationSchema>;

export type ServiceFormInitialData = Omit<ServiceFormValues, 'ports'> & {
  subdomain?: string; // subdomain is only set on the backend
  ports: {
    port: number;
    type: PortTypes;
    publish: boolean;
    ingresses?: { fqdn?: string[] }[] | null;
    rateLimit?: { limit: number; interval: string } | null;
  }[];
};

export const defaultServiceFormValues = {
  compute: {
    cpu: 62,
    memory: 128,
  },
  replicas: 1,
  autoscaler: null,
};

export interface ServiceFormProps extends DialogFormProps {
  /**
   * To use in conjunction with initialData to allow for updating the service
   */
  serviceID?: string;

  initialData?: ServiceFormInitialData;
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
  /**
   * Function to be called when the submit is successful.
   */
  onSubmit?: () => Promise<unknown>;
}

export type Port = {
  port: number;
  type: PortTypes;
  publish: boolean;
  rateLimit: number | null;
  ingresses:
    | {
        fqdn: string[];
      }[]
    | null;
};
