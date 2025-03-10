import { InfoAlert } from '@/features/orgs/components/InfoAlert';

function PiTREnabledInfoBanner() {
  return (
    <InfoAlert>
      With PiTR enabled, Scheduled backups are no longer taken. PiTR provides
      more precise recovery, making additional backups unnecessary.
    </InfoAlert>
  );
}

export default PiTREnabledInfoBanner;
