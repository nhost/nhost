import { ChevronsUpDown } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import { Combobox, type ComboboxProps } from '@/components/ui/v3/combobox';
import { cn } from '@/lib/utils';

const headerComboboxClassName =
  'h-9 justify-start gap-2 border-0 bg-background px-3 py-0 font-medium text-foreground hover:bg-neutral-100 dark:hover:bg-[#313438]';

const headerComboboxIconClassName =
  'h-9 w-9 justify-center border-0 bg-background px-0 py-0 font-medium text-foreground hover:bg-neutral-100 dark:hover:bg-[#313438]';

const headerComboboxLinkClassName =
  'inline-flex h-9 min-w-0 items-center justify-start gap-2 overflow-hidden rounded-md border-0 bg-background px-3 py-0 font-medium text-foreground whitespace-nowrap hover:bg-neutral-100 dark:hover:bg-[#313438]';

interface HeaderComboboxProps
  extends Omit<ComboboxProps, 'popoverAnchor' | 'triggerContent'> {
  linkHref?: string;
  linkContent?: ReactNode;
}

export default function HeaderCombobox({
  className,
  linkHref,
  linkContent,
  popoverContentClassName,
  ...props
}: HeaderComboboxProps) {
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const hasLink =
    !!linkHref && linkContent !== undefined && linkContent !== null;

  return (
    <div ref={setAnchor} className="flex min-w-0 items-center">
      {hasLink && (
        <Link href={linkHref} className={headerComboboxLinkClassName}>
          {linkContent}
        </Link>
      )}
      <Combobox
        {...props}
        className={cn(
          hasLink ? headerComboboxIconClassName : headerComboboxClassName,
          className,
        )}
        popoverAnchor={anchor}
        popoverContentClassName={cn(
          '[&_[cmdk-item]]:cursor-pointer',
          popoverContentClassName,
        )}
        triggerContent={
          hasLink ? (
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          ) : undefined
        }
      />
    </div>
  );
}
