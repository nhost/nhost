export const NOT_ALPHANUMERIC = /[^a-z0-9]/gi;
export const UNIQUENESS_ERROR = 'Uniqueness';
export const INSUFFICIENT_PERMISSIONS =
  'check constraint of an insert/update permission has failed';
export const INSUFFICIENT_PERMISSIONS_MESSAGE =
  'You have insufficient permisions to perform this action. Please contact your organization owner.';

/**
 * A list of database schemas that are not editable.
 */
export const READ_ONLY_SCHEMAS = ['auth', 'storage'];

/**
 * Key used to store the color preference in local storage.
 */
export const COLOR_PREFERENCE_STORAGE_KEY = 'nhost-color-preference';

/**
 * For every CPU, we allocate N times the amount of RAM.
 */
export const RESOURCE_VCPU_MEMORY_RATIO = 2;

/**
 * The infrastructure uses a multiplier of 1000 to represent vCPU cores, but the
 * vCPU values are displayed in smaller units.
 */
export const RESOURCE_VCPU_MULTIPLIER = 1000;

/**
 * The infrastructure uses MiB to represent memory, but the memory values are
 * displayed in GiB.
 */
export const RESOURCE_MEMORY_MULTIPLIER = 1024;

/**
 * Number of steps between CPU cores.
 */
export const RESOURCE_VCPU_STEP = 0.25 * RESOURCE_VCPU_MULTIPLIER;

/**
 * Number of steps between GiB of RAM.
 */
export const RESOURCE_MEMORY_STEP = 128;

/**
 * Number of steps between GiB of RAM when the ratio is locked.
 */
export const RESOURCE_MEMORY_LOCKED_STEP = 4 * RESOURCE_MEMORY_STEP;

/**
 * Price per vCPU.
 *
 * @remarks This will be moved to the backend in the future.
 */
export const RESOURCE_VCPU_PRICE = 50;

/**
 * Price per vCPU and 2 GiB of RAM per minute.
 */
export const RESOURCE_VCPU_PRICE_PER_MINUTE = 0.0012;

/**
 * Maximum number of free projects a user is allowed to have.
 */
export const MAX_FREE_PROJECTS = 1;

/**
 * Default value in minutes to use for querying the logs
 */
export const DEFAULT_LOG_INTERVAL = 15;
