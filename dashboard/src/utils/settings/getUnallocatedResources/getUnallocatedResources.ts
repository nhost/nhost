import type { ResourceSettingsFormValues } from '@/features/settings/resources/utils/resourceSettingsValidationSchema';

/**
 * Returns the unallocated resources based on the form values.
 *
 * @param formValues - The form values.
 * @returns The unallocated resources. Negative values mean that the resources
 * are overallocated.
 */
export default function getUnallocatedResources(
  formValues: Partial<ResourceSettingsFormValues>,
) {
  const allocatedVCPU =
    formValues.databaseVCPU +
    formValues.hasuraVCPU +
    formValues.authVCPU +
    formValues.storageVCPU;

  const allocatedMemory =
    formValues.databaseMemory +
    formValues.hasuraMemory +
    formValues.authMemory +
    formValues.storageMemory;

  return {
    vcpu: formValues.totalAvailableVCPU - allocatedVCPU,
    memory: formValues.totalAvailableMemory - allocatedMemory,
  };
}
