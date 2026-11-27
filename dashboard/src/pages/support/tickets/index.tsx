import { getSupportLayout } from '@/features/support/components/SupportArea';
import TicketList from '@/features/support/components/TicketList';

export default function TicketsPage() {
  return <TicketList />;
}

TicketsPage.getLayout = getSupportLayout;
