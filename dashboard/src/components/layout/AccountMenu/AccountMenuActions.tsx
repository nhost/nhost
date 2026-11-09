import { Cookie, Settings } from 'lucide-react';
import NextLink from 'next/link';
import { resetCookieConsent } from '@/components/common/CookieConsent';
import { Button } from '@/components/ui/v3/button';

interface AccountMenuActionsProps {
  onNavigate?: VoidFunction;
}

export default function AccountMenuActions({
  onNavigate,
}: AccountMenuActionsProps) {
  return (
    <div className="grid grid-flow-row gap-1 p-2">
      <Button asChild variant="menu">
        <NextLink href="/account" onClick={onNavigate}>
          <Settings className="h-4 w-4" />
          Account settings
        </NextLink>
      </Button>
      <Button variant="menu" onClick={resetCookieConsent}>
        <Cookie className="h-4 w-4" />
        Cookie settings
      </Button>
    </div>
  );
}
