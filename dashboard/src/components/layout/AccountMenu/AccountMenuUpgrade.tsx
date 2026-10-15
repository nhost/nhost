import { SparklesIcon } from 'lucide-react';
import { NavLink } from '@/components/common/NavLink';
import { useUpgradePlanLink } from '@/components/layout/AccountMenu/useUpgradePlanLink';
import { PopoverClose } from '@/components/ui/v3/popover';

export default function AccountMenuUpgrade() {
  const { isFreeOrganization, upgradeLink } = useUpgradePlanLink();

  if (!isFreeOrganization || !upgradeLink) {
    return null;
  }

  return (
    <PopoverClose asChild>
      <NavLink
        variant="ghost"
        underline="none"
        {...upgradeLink}
        className="h-9 w-full justify-start gap-2 px-2 text-primary hover:text-primary"
      >
        <SparklesIcon className="h-4 w-4" />
        Upgrade
      </NavLink>
    </PopoverClose>
  );
}
