import { EyeIcon, EyeOffIcon } from 'lucide-react';
import * as React from 'react';
import type { InputProps } from '@/components/ui/v3/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/v3/input-group';
import { cn } from '@/lib/utils';

export interface PasswordInputProps
  extends Omit<InputProps, 'prefix' | 'type'> {}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, disabled, wrapperClassName, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    return (
      <InputGroup
        className={cn(
          'h-10 bg-transparent dark:bg-transparent',
          wrapperClassName,
        )}
      >
        <InputGroupInput
          type={showPassword ? 'text' : 'password'}
          disabled={disabled}
          className={className}
          ref={ref}
          {...props}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            disabled={disabled}
            onClick={() => {
              setShowPassword((currentShowPassword) => !currentShowPassword);
            }}
            size="icon-xs"
            variant="ghost"
          >
            {showPassword ? (
              <EyeOffIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
