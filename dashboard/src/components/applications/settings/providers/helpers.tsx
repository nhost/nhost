import Copy from '@/components/icons/Copy';
import type { Provider } from '@/types/providers';
import { Button } from '@/ui/Button';
import CheckBoxes from '@/ui/Checkboxes';
import { Input } from '@/ui/Input';
import { Text } from '@/ui/Text';
import { copy } from '@/utils/copy';
import clsx from 'clsx';
import { useState } from 'react';

// TODO: Instead of a `helpers.tsx`, we should have designated files for these
// components
type ProviderSettingsProps = {
  title: string;
  desc: string;
  inputPlaceholder?: string;
  input: boolean;
  inputValue?: string;
  inputOnChange?: (v: string) => void;
  inputType?: 'text' | 'password';
  multiline?: boolean;
  link?: string;
  showCopy?: boolean;
};

export function ProviderSetting({
  title,
  desc,
  inputPlaceholder,
  input,
  inputValue,
  inputOnChange,
  inputType,
  link,
  showCopy = false,
  multiline,
}: ProviderSettingsProps) {
  return (
    <div
      className={clsx(
        'flex w-full flex-row items-center justify-between px-2 pt-3 pb-1',
      )}
    >
      <div className="flex w-80 flex-col">
        <Text
          variant="body"
          color="greyscaleDark"
          size="normal"
          className="font-medium capitalize"
        >
          {title}
        </Text>
        <Text color="greyscaleDark" size="tiny" className="font-normal">
          {desc}
        </Text>
      </div>
      <div className="flex w-full flex-row place-content-between self-center">
        {input ? (
          <Input
            placeholder={inputPlaceholder || ''}
            className="h-full w-full"
            type={inputType}
            value={inputValue}
            onChange={inputOnChange}
            multiline={multiline}
          />
        ) : (
          <div className="flex flex-row self-center align-middle">
            <Text
              color="greyscaleDark"
              size="tiny"
              className="self-center font-normal"
            >
              {link}
            </Text>
          </div>
        )}
        {showCopy && (
          <Copy
            className="ml-1 mr-4 h-4 w-4 cursor-pointer self-center text-greyscaleDark"
            onClick={() => {
              copy(link as string, title);
            }}
          />
        )}
      </div>
    </div>
  );
}

type ProviderSettingsSaveProps = {
  provider: Provider;
  loading: boolean;
};

export function ProviderSettingsSave({
  provider,
  loading,
}: ProviderSettingsSaveProps) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="mt-4 flex w-full flex-row place-content-between px-2">
      <CheckBoxes
        id="confirm-paste"
        state={confirmed}
        setState={() => setConfirmed(!confirmed)}
        checkBoxText={`I have pasted the redirect URI into ${provider.name}.`}
      />
      <div />
      <Button
        type="submit"
        variant="primary"
        disabled={!confirmed}
        loading={loading}
        className="self-center"
      >
        Confirm Settings
      </Button>
    </div>
  );
}
