import type { AlertProps } from '@/components/ui/v2/Alert';
import { Alert } from '@/components/ui/v2/Alert';
import type { ButtonProps } from '@/components/ui/v2/Button';
import { Button } from '@/components/ui/v2/Button';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { twMerge } from 'tailwind-merge';

export type ErrorMessageProps = DetailedHTMLProps<
  HTMLProps<HTMLDivElement>,
  HTMLDivElement
> & {
  /**
   * Props to be passed to the Alert component.
   */
  alertProps?: AlertProps;
  /**
   * Props to be passed to the "Try Again" button.
   */
  buttonProps?: ButtonProps;
  /**
   * Button text.
   *
   * @default "Try again"
   */
  buttonText?: string;
  /**
   * Function to be called when the "Try Again" button is clicked.
   */
  onReset?: VoidFunction;
};

export default function ErrorMessage({
  children,
  alertProps,
  buttonProps,
  buttonText = 'Try again',
  onReset,
  className,
  ...props
}: ErrorMessageProps) {
  const { className: buttonClassName, ...restButtonProps } = buttonProps || {};

  return (
    <div className={twMerge('grid gap-2', className)} {...props}>
      <Alert className="w-full" severity="error" {...alertProps}>
        {children}
      </Alert>

      {onReset && (
        <Button
          className={twMerge('justify-self-center', buttonClassName)}
          variant="outlined"
          color="secondary"
          onClick={onReset}
          {...restButtonProps}
        >
          {buttonText}
        </Button>
      )}
    </div>
  );
}
