import { SparklesIcon } from 'lucide-react';
import Link from 'next/link';
import { useUpgradePlanLink } from '@/components/layout/AccountMenu/useUpgradePlanLink';
import { Button } from '@/components/ui/v3/button';
import { PopoverClose } from '@/components/ui/v3/popover';

export default function AccountMenuUpgrade() {
  const { isFreeOrganization, href } = useUpgradePlanLink();

  if (!isFreeOrganization || !href) {
    return null;
  }

  return (
    <PopoverClose asChild>
      <Button
        asChild
        variant="menu"
        className="text-primary hover:text-primary"
      >
        <Link href={href}>
          <SparklesIcon className="h-4 w-4" />
          Upgrade
        </Link>
      </Button>
    </PopoverClose>
  );
}
