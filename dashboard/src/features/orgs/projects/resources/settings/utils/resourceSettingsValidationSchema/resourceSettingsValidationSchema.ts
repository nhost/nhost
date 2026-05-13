import * as Yup from 'yup';
import {
  RESOURCE_MEMORY_MULTIPLIER,
  RESOURCE_VCPU_MEMORY_RATIO,
  RESOURCE_VCPU_MULTIPLIER,
} from '@/utils/constants/common';

export const MIN_TOTAL_VCPU = 1 * RESOURCE_VCPU_MULTIPLIER;

export const MIN_SERVICE_REPLICAS = 1;

export const MAX_SERVICE_REPLICAS = 10;

export const MIN_AUTOSCALER_MAX_REPLICAS = 2;

export const MAX_AUTOSCALER_MAX_REPLICAS = 100;

export const MIN_SERVICE_VCPU = 0.25 * RESOURCE_VCPU_MULTIPLIER;

export const MAX_SERVICE_VCPU = 30 * RESOURCE_VCPU_MULTIPLIER;

export const MEM_CPU_RATIO = 2.048;

export const MIN_STORAGE_CAPACITY = 1;

export const MAX_STORAGE_CAPACITY = 1000;

export const MIN_SERVICE_MEMORY = 128;

export const MAX_SERVICE_MEMORY = 62464;

export const MIN_SERVICES_CPU = Math.floor(128 / MEM_CPU_RATIO);
export const MIN_SERVICES_MEM = 128;
export const MAX_SERVICES_CPU = 30000;
export const MAX_SERVICES_MEM = Math.floor(MAX_SERVICES_CPU * MEM_CPU_RATIO);
export const COST_PER_VCPU = 0.05;

const PER_SERVICE_RATIO_MESSAGE =
  'vCPU and Memory for this service must follow a 1:2 ratio when more than one replica is selected or when the autoscaler is activated.';

const genericServiceValidationSchema = Yup.object({
  replicas: Yup.number()
    .label('Replicas')
    .required()
    .min(MIN_SERVICE_REPLICAS)
    .max(MAX_SERVICE_REPLICAS),
  maxReplicas: Yup.number()
    .label('Max Replicas')
    .required()
    .min(MIN_AUTOSCALER_MAX_REPLICAS)
    .max(MAX_AUTOSCALER_MAX_REPLICAS)
    .test(
      'max-replicas-gte-replicas',
      'Max Replicas must be greater than or equal to Replicas.',
      (maxReplicas: number, { parent }) => {
        if (!parent.autoscale) {
          return true;
        }
        return maxReplicas >= parent.replicas;
      },
    ),
  autoscale: Yup.boolean().label('Autoscale').required(),
  lockRatio: Yup.boolean().label('Lock 1:2 ratio').required(),
  vcpu: Yup.number()
    .label('vCPUs')
    .required()
    .min(MIN_SERVICE_VCPU)
    .max(MAX_SERVICE_VCPU),
  memory: Yup.number()
    .required()
    .min(MIN_SERVICE_MEMORY)
    .max(MAX_SERVICE_MEMORY)
    .test(
      'is-matching-ratio',
      PER_SERVICE_RATIO_MESSAGE,
      (memory: number, { parent }) => {
        if (parent.replicas === 1 && !parent.autoscale) {
          return true;
        }
        return (
          memory /
            RESOURCE_MEMORY_MULTIPLIER /
            (parent.vcpu / RESOURCE_VCPU_MULTIPLIER) ===
          RESOURCE_VCPU_MEMORY_RATIO
        );
      },
    ),
});

const postgresServiceValidationSchema = Yup.object({
  lockRatio: Yup.boolean().label('Lock 1:2 ratio').required(),
  vcpu: Yup.number()
    .label('vCPUs')
    .required()
    .min(MIN_SERVICE_VCPU)
    .max(MAX_SERVICE_VCPU),
  memory: Yup.number()
    .required()
    .min(MIN_SERVICE_MEMORY)
    .max(MAX_SERVICE_MEMORY),
});

export const resourceSettingsValidationSchema = Yup.object({
  enabled: Yup.boolean(),
  preset: Yup.string().oneOf([
    'starter',
    'standard',
    'performance',
    'performance-reliability',
    'custom',
  ]),
  database: postgresServiceValidationSchema.required(),
  hasura: genericServiceValidationSchema.required(),
  auth: genericServiceValidationSchema.required(),
  storage: genericServiceValidationSchema.required(),
})
  .test(
    'total-cpu-min',
    `Total compute must be at least ${MIN_TOTAL_VCPU / RESOURCE_VCPU_MULTIPLIER} vCPU.`,
    (values: ResourceSettingsLooseShape | undefined) => {
      if (!values?.enabled) {
        return true;
      }
      const total =
        (values.database?.vcpu ?? 0) +
        (values.hasura?.vcpu ?? 0) +
        (values.auth?.vcpu ?? 0) +
        (values.storage?.vcpu ?? 0);
      return total >= MIN_TOTAL_VCPU;
    },
  )
  .test(
    'aggregate-ratio',
    'Total memory must equal total vCPU at the 1:2 ratio.',
    (values: ResourceSettingsLooseShape | undefined) => {
      if (!values?.enabled) {
        return true;
      }
      const totalCPU =
        (values.database?.vcpu ?? 0) +
        (values.hasura?.vcpu ?? 0) * (values.hasura?.replicas ?? 1) +
        (values.auth?.vcpu ?? 0) * (values.auth?.replicas ?? 1) +
        (values.storage?.vcpu ?? 0) * (values.storage?.replicas ?? 1);
      const totalMemory =
        (values.database?.memory ?? 0) +
        (values.hasura?.memory ?? 0) * (values.hasura?.replicas ?? 1) +
        (values.auth?.memory ?? 0) * (values.auth?.replicas ?? 1) +
        (values.storage?.memory ?? 0) * (values.storage?.replicas ?? 1);
      const expected =
        (totalCPU / RESOURCE_VCPU_MULTIPLIER) *
        RESOURCE_VCPU_MEMORY_RATIO *
        RESOURCE_MEMORY_MULTIPLIER;
      return totalMemory === expected;
    },
  );

type ResourceServiceShape = {
  vcpu?: number;
  memory?: number;
  replicas?: number;
};

type ResourceSettingsLooseShape = {
  enabled?: boolean;
  database?: ResourceServiceShape;
  hasura?: ResourceServiceShape;
  auth?: ResourceServiceShape;
  storage?: ResourceServiceShape;
};

export type ResourceSettingsFormValues = Yup.InferType<
  typeof resourceSettingsValidationSchema
>;
