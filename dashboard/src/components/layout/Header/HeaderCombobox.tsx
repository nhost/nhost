import { Combobox, type ComboboxProps } from '@/components/ui/v3/combobox';
import { cn } from '@/lib/utils';

/**
 * Shared styling for the navigation/breadcrumb comboboxes in the header:
 * borderless, 36px tall, and tinted to blend into the header bar rather than
 * read as a form field. Kept in one place so the look stays consistent and a
 * tweak is a single edit instead of a sweep across every header dropdown.
 */
const headerComboboxClassName =
  'h-9 justify-start gap-2 border-0 bg-background px-3 py-0 font-medium text-foreground hover:bg-accent dark:hover:bg-muted';

export default function HeaderCombobox({ className, ...props }: ComboboxProps) {
  return (
    <Combobox className={cn(headerComboboxClassName, className)} {...props} />
  );
}
