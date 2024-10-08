import type { ResourceSettingsFormValues } from '@/features/projects/resources/settings/utils/resourceSettingsValidationSchema';

/**
 * Returns the allocated resources based on the form values.
 *
 * @param formValues - The form values.
 * @returns The allocated resources.
 */
export default function getAllocatedResources(
  formValues: Partial<ResourceSettingsFormValues>,
) {
  return Object.keys(formValues).reduce(
    ({ vcpu, memory }, currentKey) => {
      // Skip attributes that are not related to any of the services.
      if (
        typeof formValues[currentKey] !== 'object' ||
        !(
          'vcpu' in formValues[currentKey] && 'memory' in formValues[currentKey]
        )
      ) {
        return { vcpu, memory };
      }

      return {
        vcpu: vcpu + (formValues[currentKey].vcpu || 0),
        memory: memory + (formValues[currentKey].memory || 0),
      };
    },
    {
      vcpu: 0,
      memory: 0,
    },
  );
}
