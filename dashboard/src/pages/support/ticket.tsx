import NewTicket from '@/features/support/components/NewTicket';
import { getSupportLayout } from '@/features/support/components/SupportArea';

export default function NewSupportTicketPage() {
  return <NewTicket />;
}

NewSupportTicketPage.getLayout = getSupportLayout;
