import type {
  FocusEvent,
  HTMLAttributes,
  KeyboardEvent,
  ReactElement,
} from 'react';
import { useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface PickerTriggerSlotProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  hasError: boolean;
  triggerProps: HTMLAttributes<HTMLElement> & {
    role: 'combobox';
    'aria-expanded': boolean;
    'aria-haspopup': 'dialog';
    'aria-invalid': boolean;
  };
}

export type PickerTriggerSlot<TProps extends object = object> = (
  props: PickerTriggerSlotProps & TProps,
) => ReactElement;

interface UsePickerTriggerSlotOptions {
  open: boolean;
  setOpen: (open: boolean) => void;
  hasError: boolean;
}

export default function usePickerTriggerSlot({
  open,
  setOpen,
  hasError,
}: UsePickerTriggerSlotOptions) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const pointerDownInsideRef = useRef(false);

  function isInsidePicker(target: EventTarget | null) {
    return (
      target instanceof Node &&
      (triggerRef.current?.contains(target) ||
        contentRef.current?.contains(target))
    );
  }

  function clearPointerDownInsideFlag() {
    window.setTimeout(() => {
      pointerDownInsideRef.current = false;
    }, 0);
  }

  function closeIfFocusMovedOutside() {
    window.setTimeout(() => {
      if (!isInsidePicker(document.activeElement)) {
        setOpen(false);
      }
      pointerDownInsideRef.current = false;
    }, 0);
  }

  function handleFocus(event: FocusEvent<HTMLElement>) {
    triggerRef.current = event.currentTarget;

    if (!open) {
      setOpen(true);
    }
  }

  function handleBlur(event: FocusEvent<HTMLElement>) {
    if (pointerDownInsideRef.current || isInsidePicker(event.relatedTarget)) {
      clearPointerDownInsideFlag();
      return;
    }

    closeIfFocusMovedOutside();
  }

  function focusContent() {
    const content = contentRef.current;

    if (!content) {
      return;
    }

    const focusableElement =
      content.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);

    (focusableElement ?? content).focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();

      if (!open) {
        setOpen(true);
        window.setTimeout(focusContent, 0);
        return;
      }

      focusContent();
      return;
    }

    if (event.key !== 'Escape') {
      return;
    }

    event.stopPropagation();
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleContentPointerDownCapture() {
    pointerDownInsideRef.current = true;
  }

  function handleOutsideEvent(event: Event) {
    if (isInsidePicker(event.target)) {
      event.preventDefault();
    }
  }

  function handleAutoFocus(event: Event) {
    event.preventDefault();
  }

  return {
    triggerSlotProps: {
      open,
      setOpen,
      hasError,
      triggerProps: {
        role: 'combobox' as const,
        onFocus: handleFocus,
        onBlur: handleBlur,
        onKeyDown: handleKeyDown,
        'aria-expanded': open,
        'aria-haspopup': 'dialog' as const,
        'aria-invalid': hasError,
      },
    },
    contentProps: {
      ref: contentRef,
      onPointerDownCapture: handleContentPointerDownCapture,
      onPointerDownOutside: handleOutsideEvent,
      onFocusOutside: handleOutsideEvent,
      onInteractOutside: handleOutsideEvent,
      onBlur: handleBlur,
      onOpenAutoFocus: handleAutoFocus,
      onCloseAutoFocus: handleAutoFocus,
      tabIndex: -1,
    },
  };
}
