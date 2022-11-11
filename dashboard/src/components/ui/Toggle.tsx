import { Text } from '@/ui/Text';
import { Switch } from '@headlessui/react';
import clsx from 'clsx';

type ToggleProps = {
  checked?: boolean;
  value?: boolean;
  onChange: (enabled: boolean) => void;
  showText?: boolean;
  className?: string;
};

export function Toggle({
  checked = false,
  value = false,
  onChange,
  showText = true,
  className = 'flex flex-row',
}: ToggleProps) {
  const either = checked || value;
  return (
    <div className={className}>
      {showText && (
        <Text
          size="tiny"
          className="mr-2 cursor-pointer self-center font-medium"
          color="greyscaleDark"
          onClick={() => onChange(!either)}
        >
          {either ? 'Enabled' : 'Disabled'}
        </Text>
      )}
      <Switch
        checked={either}
        onChange={onChange}
        className={clsx(
          either
            ? 'border-2 border-transparent bg-greyscaleDark'
            : 'border-2 border-greyscaleDark bg-white',
          'relative inline-flex h-5.5 w-10 flex-shrink-0 cursor-pointer self-center rounded-full subpixel-antialiased transition-colors duration-200 ease-in-out',
        )}
      >
        <span
          className={clsx(
            either ? 'translate-x-4.5' : 'translate-x-0.5 bg-greyscaleDark',
            'pointer-events-none relative inline-block h-3.5 w-3.5 transform self-center rounded-full bg-white align-middle shadow ring-0 transition duration-200 ease-in-out',
          )}
        />
      </Switch>
    </div>
  );
}

export default Toggle;
