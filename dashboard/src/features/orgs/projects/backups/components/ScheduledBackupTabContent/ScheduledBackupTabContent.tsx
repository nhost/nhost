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
        <h3 className="pb-2 font-medium text-lg">Database</h3>
        <p className="text-muted-foreground">
          The database backup includes database schema, database data and Hasura
          metadata. It does not include the actual files in Storage.
        </p>
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
