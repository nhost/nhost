/**
 * Class name of the `react-hot-toast` container, used to recognize clicks on
 * toasts.
 */
export const TOASTER_CLASS_NAME = 'app-toaster';

/**
 * Returns `true` if the target is inside the toast container. Modal dialogs
 * and sheets use this to stay open when the user interacts with a toast.
 */
export function isInsideToaster(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(`.${TOASTER_CLASS_NAME}`) !== null
  );
}
