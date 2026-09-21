import { Button } from '@/components/ui/v3/button';
import NotificationCard from '@/features/orgs/components/members/components/InboxPopover/NotificationCard';

interface PendingOrganizationRequestNotificationProps {
  onContinue: VoidFunction;
}

export default function PendingOrganizationRequestNotification({
  onContinue,
}: PendingOrganizationRequestNotificationProps) {
  return (
    <NotificationCard
      label="Pending organization request"
      actions={
        <Button size="sm" onClick={onContinue}>
          Continue
        </Button>
      }
    >
      You have previously tried to upgrade or create a new organization
    </NotificationCard>
  );
}
