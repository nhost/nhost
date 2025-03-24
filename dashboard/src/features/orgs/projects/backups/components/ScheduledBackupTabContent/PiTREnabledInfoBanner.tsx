import { InfoAlert } from '@/features/orgs/components/InfoAlert';

function PiTREnabledInfoBanner() {
  return (
    <InfoAlert>
      With Point-in-Time Recovery enabled, Scheduled backups are no longer
      taken. Point-in-Time Recovery provides more precise recovery, making
      additional backups unnecessary.
    </InfoAlert>
  );
}

export default PiTREnabledInfoBanner;
