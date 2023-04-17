import {
  RESOURCE_MEMORY_MULTIPLIER,
  RESOURCE_VCPU_MEMORY_RATIO,
  RESOURCE_VCPU_MULTIPLIER,
} from '@/utils/CONSTANTS';
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
export const MAX_TOTAL_VCPU = 60 * RESOURCE_VCPU_MULTIPLIER;

/**
 * The maximum amount of memory that can be allocated in total.
 */
export const MAX_TOTAL_MEMORY = MAX_TOTAL_VCPU * RESOURCE_VCPU_MEMORY_RATIO;

/**
 * The minimum amount of CPU that has to be allocated per service.
 */
export const MIN_SERVICE_VCPU = 0.25 * RESOURCE_VCPU_MULTIPLIER;

/**
 * The maximum amount of CPU that can be allocated per service.
 */
export const MAX_SERVICE_VCPU = 15 * RESOURCE_VCPU_MULTIPLIER;

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

export const resourceSettingsValidationSchema = Yup.object({
  enabled: Yup.boolean(),
  totalAvailableVCPU: Yup.number()
    .label('Total Available vCPUs')
    .required()
    .min(MIN_TOTAL_VCPU)
    .max(MAX_TOTAL_VCPU),
  totalAvailableMemory: Yup.number()
    .label('Available Memory')
    .required()
    .min(MIN_TOTAL_MEMORY)
    .max(MAX_TOTAL_MEMORY),
  databaseVCPU: Yup.number()
    .label('Database vCPUs')
    .required()
    .min(MIN_SERVICE_VCPU)
    .max(MAX_SERVICE_VCPU),
  databaseMemory: Yup.number()
    .label('Database Memory')
    .required()
    .min(MIN_SERVICE_MEMORY)
    .max(MAX_SERVICE_MEMORY),
  hasuraVCPU: Yup.number()
    .label('Hasura GraphQL vCPUs')
    .required()
    .min(MIN_SERVICE_VCPU)
    .max(MAX_SERVICE_VCPU),
  hasuraMemory: Yup.number()
    .label('Hasura GraphQL Memory')
    .required()
    .min(MIN_SERVICE_MEMORY)
    .max(MAX_SERVICE_MEMORY),
  authVCPU: Yup.number()
    .label('Auth vCPUs')
    .required()
    .min(MIN_SERVICE_VCPU)
    .max(MAX_SERVICE_VCPU),
  authMemory: Yup.number()
    .label('Auth Memory')
    .required()
    .min(MIN_SERVICE_MEMORY)
    .max(MAX_SERVICE_MEMORY),
  storageVCPU: Yup.number()
    .label('Storage vCPUs')
    .required()
    .min(MIN_SERVICE_VCPU)
    .max(MAX_SERVICE_VCPU),
  storageMemory: Yup.number()
    .label('Storage Memory')
    .required()
    .min(MIN_SERVICE_MEMORY)
    .max(MAX_SERVICE_MEMORY),
});

export type ResourceSettingsFormValues = Yup.InferType<
  typeof resourceSettingsValidationSchema
>;
