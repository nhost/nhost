import { AccountMenu } from '@/components/layout/AccountMenu';
import AccountMenuInbox from '@/components/layout/AccountMenu/AccountMenuInbox';
import AccountMenuUpgrade from '@/components/layout/AccountMenu/AccountMenuUpgrade';
import SupportLinks from '@/components/layout/Header/SupportLinks';
import { Separator } from '@/components/ui/v3/separator';
import {
  inboxAnchorRef,
  isInboxOpen,
} from '@/features/orgs/components/members/components/InboxPopover/inboxStore';
import { PlatformOnly } from '@/features/orgs/projects/common/components/PlatformOnly';

export interface MobileAccountMenuProps {
  hasUnreadInbox: boolean;
}

/**
 * The account menu plus the header actions that have no room below `md`:
 * upgrade, inbox and the support links. The account menu closes when the inbox
 * opens, so the inbox attaches to the menu's trigger. The menu then leaves
 * focus where the inbox put it instead of returning it to that trigger.
 */
export default function MobileAccountMenu({
  hasUnreadInbox,
}: MobileAccountMenuProps) {
  return (
    <AccountMenu
      triggerRef={inboxAnchorRef}
      onCloseAutoFocus={(event) => {
        if (isInboxOpen()) {
          event.preventDefault();
        }
      }}
    >
      <Separator />

      <div className="grid gap-1 p-2">
        <PlatformOnly>
          <AccountMenuUpgrade />
          <AccountMenuInbox hasUnread={hasUnreadInbox} />
        </PlatformOnly>
        <SupportLinks />
      </div>
    </AccountMenu>
  );
}
