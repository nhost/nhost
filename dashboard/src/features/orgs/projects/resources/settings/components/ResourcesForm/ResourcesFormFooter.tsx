import { ExternalLink } from 'lucide-react';
import { useFormState } from 'react-hook-form';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import type { ResourceSettingsFormValues } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';

export default function ResourcesFormFooter() {
  const formState = useFormState<ResourceSettingsFormValues>();
  const isDirty = Object.keys(formState.dirtyFields).length > 0;
  const hasErrors = Object.keys(formState.errors).length > 0;

  return (
    <div className="flex flex-col items-stretch gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <a
        href="https://docs.nhost.io/platform/cloud/compute-resources"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
      >
        Learn about compute resources
        <ExternalLink className="h-3.5 w-3.5" />
      </a>

      <ButtonWithLoading
        type="submit"
        disabled={!isDirty || hasErrors}
        loading={formState.isSubmitting}
        variant="default"
        size="sm"
      >
        Save changes
      </ButtonWithLoading>
    </div>
  );
}
