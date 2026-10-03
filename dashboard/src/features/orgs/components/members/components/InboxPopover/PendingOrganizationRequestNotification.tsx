import { Button } from '@/components/ui/v3/button';
import { DialogTrigger } from '@/components/ui/v3/dialog';
import NotificationCard from './NotificationCard';

export default function PendingOrganizationRequestNotification() {
  return (
    <NotificationCard
      label="Pending organization request"
      actions={
        <DialogTrigger asChild>
          <Button size="sm">Continue</Button>
        </DialogTrigger>
      }
    >
      You have previously tried to upgrade or create a new organization
    </NotificationCard>
  );
}
