import { InfoAlert } from '@/features/orgs/components/InfoAlert';

function PITREnabledInfoBanner() {
  return (
    <InfoAlert>
      With PITR enabled, Scheduled backups are no longer taken. PITR provides
      more precise recovery, making additional backups unnecessary.
    </InfoAlert>
  );
}

export default PITREnabledInfoBanner;
