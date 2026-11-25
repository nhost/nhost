import { getSupportLayout } from '@/features/support/components/SupportArea';
import TicketList from '@/features/support/components/TicketList';

import SupportHub from '@/features/support/components/SupportHub';
import { useSupportSession } from '@/features/support/hooks/use-support-session';

export default function SupportPage() {
  const { isAgent } = useSupportSession();
  return isAgent ? <TicketList /> : <SupportHub />;
}

SupportPage.getLayout = getSupportLayout;
