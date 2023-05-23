import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import { Dropdown } from '@/ui/v2/Dropdown';
import { IconButton } from '@/ui/v2/IconButton';
import { UserIcon } from '@/ui/v2/icons/UserIcon';
import { Text } from '@/ui/v2/Text';
import getConfig from 'next/config';

export default function LocalAccountMenu() {
  const { publicRuntimeConfig } = getConfig();

  return (
    <Dropdown.Root className="justify-self-center">
      <Dropdown.Trigger hideChevron asChild>
        <IconButton
          variant="borderless"
          color="secondary"
          className="h-7 w-7 rounded-full"
          sx={{
            backgroundColor: (theme) => `${theme.palette.grey[300]} !important`,
          }}
        >
          <UserIcon className="h-4 w-4" />
        </IconButton>
      </Dropdown.Trigger>

      <Dropdown.Content
        PaperProps={{
          className: 'mt-1 p-6 grid grid-flow-row gap-4 w-full max-w-xs',
        }}
      >
        <ThemeSwitcher label="Theme" />

        <Text className="text-center text-xs" color="disabled">
          Dashboard Version: {publicRuntimeConfig?.version || 'n/a'}
        </Text>
      </Dropdown.Content>
    </Dropdown.Root>
  );
}
