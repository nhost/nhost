import type { ComponentPropsWithoutRef, HTMLAttributes } from 'react';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Button, type ButtonProps } from '@/components/ui/v3/button';
import { cn } from '@/lib/utils';

type AlertProps = ComponentPropsWithoutRef<typeof Alert>;

export type ErrorMessageProps = HTMLAttributes<HTMLDivElement> & {
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
  const { className: alertClassName, ...restAlertProps } = alertProps || {};
  const { className: buttonClassName, ...restButtonProps } = buttonProps || {};

  return (
    <div className={cn('grid gap-2', className)} {...props}>
      <Alert
        variant="destructive"
        className={cn('w-full', alertClassName)}
        {...restAlertProps}
      >
        <AlertDescription>{children}</AlertDescription>
      </Alert>

      {onReset && (
        <Button
          type="button"
          className={cn('justify-self-center', buttonClassName)}
          variant="outline"
          onClick={onReset}
          {...restButtonProps}
        >
          {buttonText}
        </Button>
      )}
    </div>
  );
}
