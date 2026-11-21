import { getSupportLayout } from '@/features/support/components/SupportArea';
import TicketList from '@/features/support/components/TicketList';

export default function SupportPage() {
  return <TicketList />;
}

SupportPage.getLayout = getSupportLayout;
