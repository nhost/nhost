import { getSupportLayout } from '@/features/support/components/SupportArea';
import TicketDetail from '@/features/support/components/TicketDetail';

export default function SupportTicketPage() {
  return <TicketDetail />;
}

SupportTicketPage.getLayout = getSupportLayout;
