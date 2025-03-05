import { Tabs, TabsList, TabsTrigger } from '@/components/ui/v3/tabs';
import { PointInTimeTabsContent } from '@/features/orgs/projects/backups/components/PointInTimeTabsContent';
import { ScheduledBackupTabContent } from '@/features/orgs/projects/backups/components/ScheduledBackupTabContent';
import { memo } from 'react';

function BackupsContent({ isPITREnabled }: { isPITREnabled: boolean }) {
  // TODO: need to add logic to decide which tab is active
  const activeTab = isPITREnabled ? 'pointInTime' : 'scheduledBackups';
  return (
    <Tabs defaultValue={activeTab}>
      <TabsList>
        <TabsTrigger value="scheduledBackups">Scheduled backups</TabsTrigger>
        <TabsTrigger value="pointInTime">Point-in-time</TabsTrigger>
        <TabsTrigger value="importBackup">Import backup</TabsTrigger>
      </TabsList>
      <div className="pt-7">
        <ScheduledBackupTabContent />
        <PointInTimeTabsContent />
      </div>
    </Tabs>
  );
}

export default memo(BackupsContent);
