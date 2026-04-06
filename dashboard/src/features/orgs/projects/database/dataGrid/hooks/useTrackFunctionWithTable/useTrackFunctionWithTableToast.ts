import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { FunctionConfiguration } from '@/utils/hasura-api/generated/schemas';
import type { UseTrackFunctionWithTableOptions } from './useTrackFunctionWithTable';
import useTrackFunctionWithTable from './useTrackFunctionWithTable';

export default function useTrackFunctionWithTableToast(
  options: UseTrackFunctionWithTableOptions,
) {
  const result = useTrackFunctionWithTable(options);
  const { isTracked, isReturnTableUntracked, trackFunction, untrackFunction } =
    result;

  async function trackFunctionWithToast(configuration?: FunctionConfiguration) {
    const loadingMessage = isReturnTableUntracked
      ? 'Tracking table and function...'
      : 'Tracking function...';
    const successMessage = isReturnTableUntracked
      ? 'Table and function tracked successfully.'
      : 'Function tracked successfully.';
    const errorMessage = isReturnTableUntracked
      ? 'Failed to track table and function.'
      : 'Failed to track function.';

    await execPromiseWithErrorToast(() => trackFunction(configuration), {
      loadingMessage,
      successMessage,
      errorMessage,
    });
  }

  async function untrackFunctionWithToast() {
    await execPromiseWithErrorToast(() => untrackFunction(), {
      loadingMessage: 'Untracking function...',
      successMessage: 'Function untracked successfully.',
      errorMessage: 'Failed to untrack function.',
    });
  }

  async function toggleTrackingFunctionWithToast(
    configuration?: FunctionConfiguration,
  ) {
    if (isTracked) {
      await untrackFunctionWithToast();
    } else {
      await trackFunctionWithToast(configuration);
    }
  }

  return {
    ...result,
    trackFunctionWithToast,
    untrackFunctionWithToast,
    toggleTrackingFunctionWithToast,
  };
}
