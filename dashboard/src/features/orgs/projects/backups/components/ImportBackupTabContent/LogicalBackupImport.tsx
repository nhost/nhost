import BackupList from '@/features/orgs/projects/backups/components/ScheduledBackupTabContent/BackupList';

interface Props {
  sourceAppId: string;
  sourceProjectName: string;
  title?: string;
}

function LogicalBackupImport({ sourceAppId, sourceProjectName, title }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-[0.9375rem] leading-[1.375]">{title}</h3>
      <BackupList
        sourceAppId={sourceAppId}
        sourceProjectName={sourceProjectName}
        dialogTitle="Import backup"
        submitButtonText="Import backup"
      />
    </div>
  );
}

export default LogicalBackupImport;
