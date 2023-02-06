import { twMerge } from 'tailwind-merge'
import { Button } from '../Button'
import { Container, ContainerProps } from '../Container'
import { XIcon } from '../icons/XIcon'

export interface AnnouncementProps extends ContainerProps {
  /**
   * Function called when the announcement is closed.
   */
  onClose?: VoidFunction
}

export default function Announcement({
  children,
  slotProps,
  onClose,
  ...props
}: AnnouncementProps) {
  return (
    <Container
      {...props}
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

      {children}

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
