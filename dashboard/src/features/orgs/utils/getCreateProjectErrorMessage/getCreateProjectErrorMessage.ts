import {
  errorMessageIncludes,
  getErrorMessageSuffix,
} from '@/utils/databaseErrors';

export default function getCreateProjectErrorMessage(error: Error): string {
  const attention = getErrorMessageSuffix(
    error,
    'organization needs attention: ',
  );

  if (attention) {
    return `This organization needs attention: ${attention}`;
  }

  if (
    errorMessageIncludes(
      error,
      'Starter plan can only have one project live at a time, please pause or delete your current free project and try again.',
    )
  ) {
    return 'Your free organization already has a live project. Pause or delete it before creating another.';
  }

  if (
    errorMessageIncludes(
      error,
      'Selected region is not permitted in this organization',
    )
  ) {
    return 'The selected region is not available for this organization. Choose a different region.';
  }

  return 'An error occurred while creating the project. Please try again.';
}
