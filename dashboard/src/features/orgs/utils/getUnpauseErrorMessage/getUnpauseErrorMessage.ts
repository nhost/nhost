import {
  errorMessageIncludes,
  getErrorMessageSuffix,
} from '@/utils/databaseErrors';

export default function getUnpauseErrorMessage(error: Error): string {
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
    return 'Only one free project can be live at a time. Pause or delete your other free project first.';
  }

  if (
    errorMessageIncludes(
      error,
      'Cannot unpause project as it is not currently paused',
    )
  ) {
    return 'This project cannot be started until it is fully paused. Please try again shortly.';
  }

  return 'An error occurred while waking up the project. Please try again.';
}
