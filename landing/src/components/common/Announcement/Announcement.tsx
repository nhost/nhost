import { ForwardedRef, forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '../Button'
import { Container, ContainerProps } from '../Container'
import { ArrowRightIcon } from '../icons/ArrowRightIcon'
import { XIcon } from '../icons/XIcon'
import { Link } from '../Link'

export interface AnnouncementProps extends ContainerProps {
  /**
   * Function called when the announcement is closed.
   */
  onClose?: VoidFunction
  /**
   * The href to use for the announcement link.
   */
  href: string
}

function Announcement(
  { children, slotProps, onClose, href, ...props }: AnnouncementProps,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <Container
      {...props}
      ref={ref}
      className="grid grid-flow-col justify-between gap-4"
      slotProps={{
        root: {
          ...(slotProps?.root || {}),
          className: twMerge(
            'w-full border-b border-divider bg-paper py-1.5',
            slotProps?.root?.className,
          ),
        },
      }}
    >
      <span />

      <div className="flex items-center self-center truncate">
        <Link href={href} className="text-opacity-100">
          <span className="truncate">{children}</span>{' '}
          <ArrowRightIcon className="ml-1 h-4 w-4 text-white" />
        </Link>
      </div>

      <Button
        variant="borderless"
        onClick={onClose}
        aria-label="Close announcement"
        size="xs"
        className="rounded-sm p-1"
      >
        <XIcon className="h-4 w-4 opacity-65" />
      </Button>
    </Container>
  )
}

export default forwardRef(Announcement)
