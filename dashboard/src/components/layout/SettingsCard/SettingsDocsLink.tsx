import * as React from 'react';
import { TextLink } from '@/components/ui/v3/text-link';
import { cn } from '@/lib/utils';

export interface SettingsDocsLinkProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * Documentation URL.
   */
  href: string;
  /**
   * Label rendered after "Learn more about". Defaults to `children`.
   */
  title?: React.ReactNode;
}

const SettingsDocsLink = React.forwardRef<
  HTMLDivElement,
  SettingsDocsLinkProps
>(({ className, href, title, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex w-full justify-start gap-x-1 align-middle sm:mr-auto sm:w-auto sm:self-center',
      className,
    )}
    {...props}
  >
    <p>
      Learn more about{' '}
      <TextLink href={href} external className="font-medium">
        {title ?? children}
      </TextLink>
    </p>
  </div>
));
SettingsDocsLink.displayName = 'SettingsDocsLink';

export { SettingsDocsLink };
