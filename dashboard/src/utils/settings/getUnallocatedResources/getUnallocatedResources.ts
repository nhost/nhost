import type { ResourceSettingsFormValues } from '@/utils/settings/resourceSettingsValidationSchema';

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
  const allocatedCPU =
    formValues.databaseCPU +
    formValues.hasuraCPU +
    formValues.authCPU +
    formValues.storageCPU;

  const allocatedRAM =
    formValues.databaseRAM +
    formValues.hasuraRAM +
    formValues.authRAM +
    formValues.storageRAM;

  return {
    cpu: formValues.totalAvailableCPU - allocatedCPU,
    ram: formValues.totalAvailableRAM - allocatedRAM,
  };
}
