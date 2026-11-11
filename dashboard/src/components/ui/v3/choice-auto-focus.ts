const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

// Search boxes such as cmdk's input carry role="combobox" but are typed into.
const TEXT_FIELD =
  'textarea, [contenteditable="true"], input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"])';

const CHOICE_CONTROL =
  'select, input[type="checkbox"], input[type="radio"], [role="combobox"], [role="listbox"], [role="checkbox"], [role="radio"], [role="radiogroup"], [role="switch"]';

/**
 * Radix focuses the first tabbable element when a dialog opens. Only text
 * fields should get focus on open: a dropdown, checkbox, radio or switch still
 * needs the same click, so focus the dialog itself instead.
 */
export function skipChoiceControlAutoFocus(event: Event) {
  const content = event.target;
  if (!(content instanceof HTMLElement)) {
    return;
  }

  const firstTabbable = content.querySelector<HTMLElement>(TABBABLE);
  if (
    firstTabbable?.matches(CHOICE_CONTROL) &&
    !firstTabbable.matches(TEXT_FIELD)
  ) {
    event.preventDefault();
    content.focus({ preventScroll: true });
  }
}
