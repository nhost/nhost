import { Text } from '@/components/ui/v2/Text';
import { Spinner } from '@/components/ui/v3/spinner';
import { TabsContent } from '@/components/ui/v3/tabs';
import { useIsPiTREnabled } from '@/features/orgs/hooks/useIsPiTREnabled';
import BackupList from './BackupList';
import PiTREnabledInfoBanner from './PiTREnabledInfoBanner';

function ScheduledBackupTabContent() {
  const { isPiTREnabled, loading } = useIsPiTREnabled();
  const content = isPiTREnabled ? (
    <PiTREnabledInfoBanner />
  ) : (
    <>
      <div>
        <Text variant="h3" className="pb-2">
          Database
        </Text>
        <Text color="secondary">
          The database backup includes database schema, database data and Hasura
          metadata. It does not include the actual files in Storage.
        </Text>
      </div>

      <BackupList />
    </>
  );
  return (
    <TabsContent value="scheduledBackups">
      <div className="grid w-full grid-flow-row gap-6">
        {loading ? <Spinner /> : content}
      </div>
    </TabsContent>
  );
}

export default ScheduledBackupTabContent;
