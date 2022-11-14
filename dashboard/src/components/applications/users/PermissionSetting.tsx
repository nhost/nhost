import type { SelectorOption } from '@/ui/Selector';
import Selector from '@/ui/Selector';
import { Text } from '@/ui/Text';
import { Toggle } from '@/ui/Toggle';
import clsx from 'clsx';

export interface PermissionSettingsProps {
  text: string;
  desc?: string;
  toggle?: boolean;
  onChange?: any;
  checked?: boolean;
  options?: any;
  value?: SelectorOption;
} // @TODO: Fix alt attribute on images.
// @FIX: Double border

export function PermissionSetting({
  text,
  desc,
  toggle,
  checked = false,
  onChange,
  options,
  value,
}: PermissionSettingsProps) {
  return (
    <div className="flex flex-row place-content-between py-2">
      <div
        className={clsx(
          'flex flex-col space-y-1 self-center px-0.5',
          !desc && 'py-3.5',
          desc && 'py-2',
        )}
      >
        <Text
          variant="body"
          size="normal"
          className="font-medium"
          color="greyscaleDark"
        >
          {text}
        </Text>
        {desc && (
          <Text
            variant="body"
            size="tiny"
            className="font-normal"
            color="greyscaleDark"
          >
            {desc}
          </Text>
        )}
      </div>
      {toggle ? (
        <div className="flex flex-row">
          <Toggle checked={checked} onChange={onChange} />
        </div>
      ) : (
        <div className="flex  flex-row self-center">
          <Selector
            width="w-28"
            options={options}
            onChange={onChange}
            value={value}
          />
        </div>
      )}
    </div>
  );
}
