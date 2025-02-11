import {
  RESOURCE_MEMORY_MULTIPLIER,
  RESOURCE_VCPU_MEMORY_RATIO,
  RESOURCE_VCPU_MULTIPLIER,
} from '@/utils/constants/common';
import * as Yup from 'yup';

/**
 * The minimum total CPU that has to be allocated.
 */
export const MIN_TOTAL_VCPU = 1 * RESOURCE_VCPU_MULTIPLIER;

/**
 * The minimum amount of memory that has to be allocated in total.
 */
export const MIN_TOTAL_MEMORY =
  (MIN_TOTAL_VCPU / RESOURCE_VCPU_MULTIPLIER) *
  RESOURCE_VCPU_MEMORY_RATIO *
  RESOURCE_MEMORY_MULTIPLIER;

/**
 * The maximum total CPU that can be allocated.
 */
export const MAX_TOTAL_VCPU = 28 * RESOURCE_VCPU_MULTIPLIER;

/**
 * The maximum amount of memory that can be allocated in total.
 */
export const MAX_TOTAL_MEMORY = MAX_TOTAL_VCPU * RESOURCE_VCPU_MEMORY_RATIO;

/**
 * The minimum amount of replicas that has to be allocated per service.
 */
export const MIN_SERVICE_REPLICAS = 1;

/**
 * The maximum amount of replicas that can be allocated per service.
 */
export const MAX_SERVICE_REPLICAS = 32;

/**
 * The minimum amount of CPU that has to be allocated per service.
 */
export const MIN_SERVICE_VCPU = 0.25 * RESOURCE_VCPU_MULTIPLIER;

/**
 * The maximum amount of CPU that can be allocated per service.
 */
export const MAX_SERVICE_VCPU = 7 * RESOURCE_VCPU_MULTIPLIER;

/**
 * Best resource utilization ration for CPU-Memory.
 */
export const MEM_CPU_RATIO = 2.048;

/**
 * Minimum storage capacity (Gib)
 */
export const MIN_STORAGE_CAPACITY = 1;

/**
 * Maximum storage capacity (Gib)
 */
export const MAX_STORAGE_CAPACITY = 1000;

/**
 * The minimum amount of memory that has to be allocated per service.
 */
export const MIN_SERVICE_MEMORY = 128;

/**
 * The maximum amount of memory that can be allocated per service.
 */
export const MAX_SERVICE_MEMORY =
  (MAX_SERVICE_VCPU / RESOURCE_VCPU_MULTIPLIER) *
  RESOURCE_VCPU_MEMORY_RATIO *
  RESOURCE_MEMORY_MULTIPLIER;

const genericServiceValidationSchema = Yup.object({
  replicas: Yup.number()
    .label('Replicas')
    .required()
    .min(1)
    .max(MAX_SERVICE_REPLICAS),
  maxReplicas: Yup.number()
    .label('Max Replicas')
    .required()
    .min(MIN_SERVICE_REPLICAS)
    .max(MAX_SERVICE_REPLICAS),
  autoscale: Yup.boolean().label('Autoscale').required(),
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
      `vCPU and Memory for this service must follow a 1:${RESOURCE_VCPU_MEMORY_RATIO} ratio when more than one replica is selected or when the autoscaler is activated.`,
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
  vcpu: Yup.number()
    .label('vCPUs')
    .required()
    .min(MIN_SERVICE_VCPU)
    .max(MAX_SERVICE_VCPU),
  memory: Yup.number()
    .required()
    .min(MIN_SERVICE_MEMORY)
    .max(MAX_SERVICE_MEMORY)
});

export const resourceSettingsValidationSchema = Yup.object({
  enabled: Yup.boolean(),
  totalAvailableVCPU: Yup.number()
    .label('Total Available vCPUs')
    .required()
    .min(MIN_TOTAL_VCPU)
    .max(MAX_TOTAL_VCPU)
    .test(
      'is-equal-to-services',
      'Total vCPUs must be equal to the sum of all services.',
      (totalAvailableVCPU: number, { parent }) =>
        parent.database.vcpu +
          parent.hasura.vcpu +
          parent.auth.vcpu +
          parent.storage.vcpu ===
        totalAvailableVCPU,
    ),
  totalAvailableMemory: Yup.number()
    .label('Available Memory')
    .required()
    .min(MIN_TOTAL_MEMORY)
    .max(MAX_TOTAL_MEMORY)
    .test(
      'is-equal-to-services',
      'Total memory must be equal to the sum of all services.',
      (totalAvailableMemory: number, { parent }) =>
        parent.database.memory +
          parent.hasura.memory +
          parent.auth.memory +
          parent.storage.memory ===
        totalAvailableMemory,
    ),
  database: postgresServiceValidationSchema.required(),
  hasura: genericServiceValidationSchema.required(),
  auth: genericServiceValidationSchema.required(),
  storage: genericServiceValidationSchema.required(),
});

export type ResourceSettingsFormValues = Yup.InferType<
  typeof resourceSettingsValidationSchema
>;

export const MIN_SERVICES_CPU = Math.floor(128 / MEM_CPU_RATIO);
export const MIN_SERVICES_MEM = 128;
export const MAX_SERVICES_CPU = 7000;
export const MAX_SERVICES_MEM = Math.floor(MAX_SERVICES_CPU * MEM_CPU_RATIO);
export const COST_PER_VCPU = 0.05;
