import { CREATE_PROJECT_LIMIT_MESSAGE } from '@/features/orgs/components/projects/CreateProjectLimitDialog';
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
    return CREATE_PROJECT_LIMIT_MESSAGE;
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
