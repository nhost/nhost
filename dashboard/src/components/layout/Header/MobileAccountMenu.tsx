import { useRef, useState } from 'react';
import { AccountMenu } from '@/components/layout/AccountMenu';
import AccountMenuInbox from '@/components/layout/AccountMenu/AccountMenuInbox';
import AccountMenuUpgrade from '@/components/layout/AccountMenu/AccountMenuUpgrade';
import SupportLinks from '@/components/layout/Header/SupportLinks';
import { Separator } from '@/components/ui/v3/separator';
import {
  InboxSheet,
  type InboxState,
} from '@/features/orgs/components/members/components/InboxPopover';

export interface MobileAccountMenuProps {
  inbox: InboxState;
}

/**
 * The account menu plus the header actions that have no room below `md`:
 * upgrade, inbox and the support links. The inbox opens as a sheet because a
 * popover cannot open from inside another popover.
 */
export default function MobileAccountMenu({ inbox }: MobileAccountMenuProps) {
  const [inboxOpen, setInboxOpen] = useState(false);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <AccountMenu triggerRef={accountTriggerRef}>
        <Separator />

        <div className="grid gap-1 p-2">
          <AccountMenuUpgrade />
          <AccountMenuInbox
            hasUnread={inbox.hasUnread}
            onClick={() => setInboxOpen(true)}
          />
          <SupportLinks />
        </div>
      </AccountMenu>

      <InboxSheet
        inbox={inbox}
        open={inboxOpen}
        onOpenChange={setInboxOpen}
        triggerRef={accountTriggerRef}
      />
    </>
  );
}
