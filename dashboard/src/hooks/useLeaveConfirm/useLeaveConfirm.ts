import { useBlocker } from '@tanstack/react-router';
import { useDialog } from '@/components/common/DialogProvider';

export interface UseLeaveConfirmProps {
  /**
   * Whether the form is dirty or not.
   */
  isDirty?: boolean;
}

/**
 * This hook will show a confirmation dialog when the user tries to leave the
 * current page while the form is dirty. Discarding continues the navigation;
 * closing the dialog any other way keeps the user on the page.
 */
export default function useLeaveConfirm({ isDirty }: UseLeaveConfirmProps) {
  const { openAlertDialog } = useDialog();

  useBlocker({
    shouldBlockFn: () => {
      if (!isDirty) {
        return false;
      }

      return new Promise<boolean>((resolve) => {
        let discarded = false;

        openAlertDialog({
          title: 'Unsaved changes',
          payload:
            'You have unsaved local changes. Are you sure you want to discard them?',
          props: {
            primaryButtonColor: 'error',
            primaryButtonText: 'Discard',
            onPrimaryAction: () => {
              discarded = true;
              resolve(false);
            },
            // Runs once the dialog has closed, however it was closed.
            TransitionProps: {
              onExited: () => {
                if (!discarded) {
                  resolve(true);
                }
              },
            },
          },
        });
      });
    },
    // The Next.js version only guarded in-app navigation.
    enableBeforeUnload: false,
  });
}
