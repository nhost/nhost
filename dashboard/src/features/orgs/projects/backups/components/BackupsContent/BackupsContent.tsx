import { Tabs, TabsList, TabsTrigger } from '@/components/ui/v3/tabs';
import { ImportBackupTabContent } from '@/features/orgs/projects/backups/components/ImportBackupTabContent';
import { PointInTimeTabsContent } from '@/features/orgs/projects/backups/components/PointInTimeTabsContent';
import { ScheduledBackupTabContent } from '@/features/orgs/projects/backups/components/ScheduledBackupTabContent';
import { memo, useState } from 'react';

function BackupsContent({ isPiTREnabled }: { isPiTREnabled: boolean }) {
  const [tab, setTab] = useState(() =>
    isPiTREnabled ? 'pointInTime' : 'scheduledBackups',
  );
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="scheduledBackups">Scheduled backups</TabsTrigger>
        <TabsTrigger value="pointInTime">Point-in-time</TabsTrigger>
        <TabsTrigger value="importBackup">Import backup</TabsTrigger>
      </TabsList>
      <div className="pt-7">
        <ScheduledBackupTabContent />
        {tab === 'pointInTime' && <PointInTimeTabsContent />}
        {tab === 'importBackup' && <ImportBackupTabContent />}
      </div>
    </Tabs>
  );
}

export default memo(BackupsContent);
