import { Button } from '@/components/ui/v2/Button';
import { ArrowRightIcon } from '@/components/ui/v2/icons/ArrowRightIcon';
import { XIcon } from '@/components/ui/v2/icons/XIcon';
import { Text } from '@/components/ui/v2/Text';
import Link from 'next/link';
import { forwardRef, type ForwardedRef } from 'react';
import { twMerge } from 'tailwind-merge';
import AnnouncementContainer, {
  type AnnouncementContainerProps,
} from './AnnouncementContainer';

export interface AnnouncementProps extends AnnouncementContainerProps {
  /**
   * Function called when the announcement is closed.
   */
  onClose?: VoidFunction;
  /**
   * The href to use for the announcement link.
   */
  href: string;
}

function Announcement(
  { children, slotProps, onClose, href, ...props }: AnnouncementProps,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <AnnouncementContainer
      {...props}
      ref={ref}
      className="grid justify-between grid-flow-col gap-4"
      slotProps={{
        root: {
          ...(slotProps?.root || {}),
          className: twMerge('w-full py-1.5', slotProps?.root?.className),
        },
      }}
    >
      <span />

      <div className="flex items-center self-center truncate">
        <Link href={href}>
          <Text className="truncate cursor-pointer hover:underline">
            {children}
          </Text>
        </Link>
        <ArrowRightIcon className="w-4 h-4 ml-1 text-white" />
      </div>

      <Button
        variant="borderless"
        onClick={onClose}
        aria-label="Close announcement"
        size="small"
        className="p-1 rounded-sm"
      >
        <XIcon className="w-4 h-4 opacity-65" />
      </Button>
    </AnnouncementContainer>
  );
}

export default forwardRef(Announcement);
