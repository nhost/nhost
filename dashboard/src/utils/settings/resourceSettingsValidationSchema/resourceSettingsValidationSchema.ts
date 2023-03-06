import { RESOURCE_VCPU_MEMORY_RATIO } from '@/utils/CONSTANTS';
import * as Yup from 'yup';

/**
 * The minimum total CPU that has to be allocated.
 */
export const MIN_TOTAL_VCPU = 1;

/**
 * The minimum amount of memory that has to be allocated in total.
 */
export const MIN_TOTAL_MEMORY = MIN_TOTAL_VCPU * RESOURCE_VCPU_MEMORY_RATIO;

/**
 * The maximum total CPU that can be allocated.
 */
export const MAX_TOTAL_VCPU = 60;

/**
 * The maximum amount of memory that can be allocated in total.
 */
export const MAX_TOTAL_MEMORY = MAX_TOTAL_VCPU * RESOURCE_VCPU_MEMORY_RATIO;

/**
 * The minimum amount of CPU that has to be allocated per service.
 */
export const MIN_SERVICE_VCPU = 0.25;

/**
 * The maximum amount of CPU that can be allocated per service.
 */
export const MAX_SERVICE_VCPU = 15;

/**
 * The minimum amount of memory that has to be allocated per service.
 */
export const MIN_SERVICE_MEMORY = MIN_SERVICE_VCPU * RESOURCE_VCPU_MEMORY_RATIO;

/**
 * The maximum amount of memory that can be allocated per service.
 */
export const MAX_SERVICE_MEMORY = MAX_SERVICE_VCPU * RESOURCE_VCPU_MEMORY_RATIO;

export const resourceSettingsValidationSchema = Yup.object({
  enabled: Yup.boolean(),
  totalSelectedCPU: Yup.number()
    .label('Total CPU')
    .required()
    .min(MIN_TOTAL_VCPU)
    .max(MAX_TOTAL_VCPU),
  totalSelectedMemory: Yup.number()
    .label('Total Memory')
    .required()
    .min(MIN_TOTAL_MEMORY)
    .max(MAX_TOTAL_MEMORY),
  databaseCPU: Yup.number()
    .label('Database CPU')
    .required()
    .min(MIN_SERVICE_VCPU)
    .max(MAX_SERVICE_VCPU),
  databaseMemory: Yup.number()
    .label('Database Memory')
    .required()
    .min(MIN_SERVICE_MEMORY)
    .max(MAX_SERVICE_MEMORY),
  hasuraCPU: Yup.number()
    .label('Hasura CPU')
    .required()
    .min(MIN_SERVICE_VCPU)
    .max(MAX_SERVICE_VCPU),
  hasuraMemory: Yup.number()
    .label('Hasura Memory')
    .required()
    .min(MIN_SERVICE_MEMORY)
    .max(MAX_SERVICE_MEMORY),
  authCPU: Yup.number()
    .label('Auth CPU')
    .required()
    .min(MIN_SERVICE_VCPU)
    .max(MAX_SERVICE_VCPU),
  authMemory: Yup.number()
    .label('Auth Memory')
    .required()
    .min(MIN_SERVICE_MEMORY)
    .max(MAX_SERVICE_MEMORY),
  storageCPU: Yup.number()
    .label('Storage CPU')
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
