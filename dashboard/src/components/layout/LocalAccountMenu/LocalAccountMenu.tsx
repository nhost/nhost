import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import { Avatar } from '@/components/ui/v2/Avatar';
import { Box } from '@/components/ui/v2/Box';
import { Divider } from '@/components/ui/v2/Divider';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { IconButton } from '@/components/ui/v2/IconButton';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import { Text } from '@/components/ui/v2/Text';
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
          className: 'mt-1 grid grid-flow-row w-full max-w-xs',
        }}
      >
        <Box className="grid grid-flow-col items-center justify-start gap-4 p-4">
          <Avatar className="h-10 w-10">Local User</Avatar>

          <Box className="grid grid-flow-row gap-0.5">
            <Text className="font-semibold">Local User</Text>
          </Box>
        </Box>

        <Divider />

        <Box className="grid grid-flow-row gap-2 p-2">
          <ThemeSwitcher
            label="Theme"
            variant="inline"
            fullWidth
            className="grid-cols-auto justify-between px-2"
            slotProps={{
              label: { className: '!text-sm+' },
            }}
          />
        </Box>

        <Divider />

        <Box className="py-4">
          <Text className="text-center text-xs" color="disabled">
            Dashboard Version: {publicRuntimeConfig?.version || 'n/a'}
          </Text>
        </Box>
      </Dropdown.Content>
    </Dropdown.Root>
  );
}
