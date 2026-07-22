import { UserIcon } from 'lucide-react';
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import { Avatar } from '@/components/ui/v2/Avatar';
import { IconButton } from '@/components/ui/v2/IconButton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { Separator } from '@/components/ui/v3/separator';
import { getDashboardVersion } from '@/utils/env';

export default function LocalAccountMenu() {
  return (
    <div className="justify-self-center">
      <Popover>
        <PopoverTrigger asChild>
          <IconButton
            variant="borderless"
            color="secondary"
            className="h-7 w-7 rounded-full"
            sx={{
              backgroundColor: (theme) =>
                `${theme.palette.grey[300]} !important`,
            }}
          >
            <UserIcon className="h-4 w-4" />
          </IconButton>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          className="mt-1 grid w-full max-w-xs grid-flow-row p-0"
        >
          <div className="grid grid-flow-col items-center justify-start gap-4 p-4">
            <Avatar className="h-10 w-10">Local User</Avatar>

            <div className="grid grid-flow-row gap-0.5">
              <span className="font-semibold">Local User</span>
            </div>
          </div>

          <Separator />

          <div className="grid grid-flow-row gap-2 p-2">
            <ThemeSwitcher />
          </div>

          <Separator />

          <div className="py-4 text-center text-muted-foreground text-xs">
            Dashboard Version: {getDashboardVersion()}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
