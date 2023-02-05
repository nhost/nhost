import { twMerge } from 'tailwind-merge'
import { Button, ButtonProps } from '../Button'

export interface ExampleSelectorButtonProps extends ButtonProps {
  /**
   * Determines whether the button is active or not.
   */
  active?: boolean
}

export default function ExampleSelectorButton({
  active,
  className,
  ...props
}: ExampleSelectorButtonProps) {
  return (
    <div
      className={twMerge(
        'relative',
        active &&
          'before:absolute before:bottom-0 before:left-0 before:right-0 before:top-0 before:z-0 before:skew-y-3 before:rounded-md before:bg-brand-main before:bg-opacity-50 before:blur-xl before:motion-safe:transition-all',
      )}
    >
      <Button
        variant={active ? 'outlined' : 'borderless'}
        size="sm"
        className={twMerge(
          'relative z-10',
          'border-0 md:border',
          'bg-transparent hover:bg-transparent hover:bg-opacity-100 md:bg-black md:hover:bg-black',
          'px-0 md:px-2 xl:px-4',
          'text-xs md:text-sm',
          'rounded-none md:rounded-md',
          !active
            ? 'text-opacity-65'
            : 'border-b border-b-white md:border-b-divider',
        )}
        {...props}
      />
    </div>
  )
}
