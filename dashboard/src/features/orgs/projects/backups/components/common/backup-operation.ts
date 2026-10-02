export type BackupOperation = 'restore' | 'import';

interface BackupListOperationCopy {
  actionButtonText: string;
  confirmationCheckboxLabel: string;
  dialogTitle: string;
  submitButtonText: string;
}

interface PointInTimeOperationCopy {
  confirmationActionText: string;
  dialogTitle: string;
  submitButtonText: string;
  triggerButtonText: string;
}

interface BackupOperationToastMessages {
  errorMessage: string;
  loadingMessage: string;
  successMessage: string;
}

interface BackupOperationCopy {
  backupList: BackupListOperationCopy;
  pointInTime: PointInTimeOperationCopy;
  scheduledOperationLabel: BackupOperation;
  toastMessages: BackupOperationToastMessages;
}

export const BACKUP_OPERATION_COPY: Record<
  BackupOperation,
  BackupOperationCopy
> = {
  restore: {
    backupList: {
      actionButtonText: 'Restore',
      confirmationCheckboxLabel: "I'm sure I want to restore this backup",
      dialogTitle: 'Restore Backup',
      submitButtonText: 'Restore',
    },
    pointInTime: {
      confirmationActionText: 'restoring',
      dialogTitle: 'Recover your database from a backup',
      submitButtonText: 'Restore backup',
      triggerButtonText: 'Start restore',
    },
    scheduledOperationLabel: 'restore',
    toastMessages: {
      errorMessage:
        'An error occurred while attempting to schedule a backup restore. Please try again.',
      loadingMessage: 'Starting restore from backup...',
      successMessage: 'Backup restore has been scheduled successfully.',
    },
  },
  import: {
    backupList: {
      actionButtonText: 'Import',
      confirmationCheckboxLabel: "I'm sure I want to import this backup",
      dialogTitle: 'Import backup',
      submitButtonText: 'Import backup',
    },
    pointInTime: {
      confirmationActionText: 'importing',
      dialogTitle: 'Import backup',
      submitButtonText: 'Import backup',
      triggerButtonText: 'Start import',
    },
    scheduledOperationLabel: 'import',
    toastMessages: {
      errorMessage:
        'An error occurred while attempting to schedule a backup import. Please try again.',
      loadingMessage: 'Starting import from backup...',
      successMessage: 'Backup import has been scheduled successfully.',
    },
  },
};
