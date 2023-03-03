import { RESOURCE_RAM_MULTIPLIER } from '@/utils/CONSTANTS';
import * as Yup from 'yup';

/**
 * The minimum total CPU that has to be allocated.
 */
export const MIN_TOTAL_CPU = 1;

/**
 * The minimum total RAM that has to be allocated.
 */
export const MIN_TOTAL_RAM = MIN_TOTAL_CPU * RESOURCE_RAM_MULTIPLIER;

/**
 * The maximum total CPU that can be allocated.
 */
export const MAX_TOTAL_CPU = 60;

/**
 * The maximum total RAM that can be allocated.
 */
export const MAX_TOTAL_RAM = MAX_TOTAL_CPU * RESOURCE_RAM_MULTIPLIER;

/**
 * The minimum amount of CPU that has to be allocated per service.
 */
export const MIN_SERVICE_CPU = 0.25;

/**
 * The maximum total CPU that can be allocated per service.
 */
export const MAX_SERVICE_CPU = 15;

/**
 * The minimum amount of RAM that has to be allocated per service.
 */
export const MIN_SERVICE_RAM = MIN_SERVICE_CPU * RESOURCE_RAM_MULTIPLIER;

/**
 * The maximum total RAM that can be allocated per service.
 */
export const MAX_SERVICE_RAM = MAX_SERVICE_CPU * RESOURCE_RAM_MULTIPLIER;

export const resourceSettingsValidationSchema = Yup.object({
  enabled: Yup.boolean(),
  totalAvailableCPU: Yup.number()
    .label('Total CPU')
    .required()
    .min(MIN_TOTAL_CPU)
    .max(MAX_TOTAL_CPU),
  totalAvailableRAM: Yup.number()
    .label('Total RAM')
    .required()
    .min(MIN_TOTAL_RAM)
    .max(MAX_TOTAL_RAM),
  databaseCPU: Yup.number()
    .label('Database CPU')
    .required()
    .min(MIN_SERVICE_CPU)
    .max(MAX_SERVICE_CPU),
  databaseRAM: Yup.number()
    .label('Database RAM')
    .required()
    .min(MIN_SERVICE_RAM)
    .max(MAX_SERVICE_RAM),
  hasuraCPU: Yup.number()
    .label('Hasura CPU')
    .required()
    .min(MIN_SERVICE_CPU)
    .max(MAX_SERVICE_CPU),
  hasuraRAM: Yup.number()
    .label('Hasura RAM')
    .required()
    .min(MIN_SERVICE_RAM)
    .max(MAX_SERVICE_RAM),
  authCPU: Yup.number()
    .label('Auth CPU')
    .required()
    .min(MIN_SERVICE_CPU)
    .max(MAX_SERVICE_CPU),
  authRAM: Yup.number()
    .label('Auth RAM')
    .required()
    .min(MIN_SERVICE_RAM)
    .max(MAX_SERVICE_RAM),
  storageCPU: Yup.number()
    .label('Storage CPU')
    .required()
    .min(MIN_SERVICE_CPU)
    .max(MAX_SERVICE_CPU),
  storageRAM: Yup.number()
    .label('Storage RAM')
    .required()
    .min(MIN_SERVICE_RAM)
    .max(MAX_SERVICE_RAM),
});

export type ResourceSettingsFormValues = Yup.InferType<
  typeof resourceSettingsValidationSchema
>;
