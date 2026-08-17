import { TZDate } from '@date-fns/tz';
import { DialogDescription } from '@radix-ui/react-dialog';
import { format, isBefore, startOfDay } from 'date-fns';
import { memo, useCallback, useState } from 'react';
import { DateTimePicker } from '@/components/common/DateTimePicker';
import { isTZDate } from '@/components/common/TimePicker/time-picker-utils';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/v3/dialog';
import { useRestoreApplicationDatabasePiTR } from '@/features/orgs/hooks/useRestoreApplicationDatabasePiTR';
import BackupScheduledInfo from '@/features/orgs/projects/backups/components/common/BackupScheduledInfo';
import {
  BACKUP_OPERATION_COPY,
  type BackupOperation,
} from '@/features/orgs/projects/backups/components/common/backup-operation';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import StartRestoreConfirmationCheck from './StartRestoreConfirmationCheck';

interface Props {
  fromAppId: string;
  earliestBackupDate: string;
  disabled?: boolean;
  operation?: BackupOperation;
}

type RestoreBackupDialogButtonWrapperProps = Omit<
  Props,
  'earliestBackupDate'
> & {
  earliestBackupDate?: string;
};

function RestoreBackupDialogButton({
  disabled,
  earliestBackupDate,
  fromAppId,
  operation = 'restore',
}: Props) {
  const [open, setOpen] = useState(false);
  const [isRestoreScheduled, setIsRestoreScheduled] = useState(false);

  const [restoreTargetTime, setRestoreTargetTime] =
    useState(earliestBackupDate);

  const [restoreTargetIsBeforeError, setRestoreTargetIsBeforeError] = useState<
    string | undefined
  >();

  const [
    permanentlyDeleteCurrentDataCheck,
    setPermanentlyDeleteCurrentDataCheck,
  ] = useState(false);
  const [cannotBeUndoneCheck, setCannotBeUndoneCheck] = useState(false);

  const { project } = useProject();
  const { org } = useCurrentOrg();

  const { restoreApplicationDatabase, loading } =
    useRestoreApplicationDatabasePiTR();
  const operationCopy = BACKUP_OPERATION_COPY[operation].pointInTime;
  const toastMessages = BACKUP_OPERATION_COPY[operation].toastMessages;

  async function handleRestore() {
    if (isNotEmptyValue(restoreTargetTime)) {
      const variables = {
        appId: project?.id,
        recoveryTarget: restoreTargetTime,
        fromAppId: fromAppId === project?.id ? null : fromAppId,
      };
      restoreApplicationDatabase(
        variables,
        () => setIsRestoreScheduled(true),
        toastMessages,
      );
    }
  }

  function formatDateFn(date: Date | TZDate | string) {
    return format(date, 'dd MMM yyyy, HH:mm:ss (OOOO)').replace('GMT', 'UTC');
  }

  function isCalendarDayDisabled(date: Date | TZDate) {
    if (isTZDate(date)) {
      const utcDay = new Date(date.getTime()).toISOString();
      const tzDate = new TZDate(utcDay, date.timeZone);
      const earliestBackupDateInTz = new TZDate(
        earliestBackupDate,
        date.timeZone,
      );
      return isBefore(startOfDay(tzDate), startOfDay(earliestBackupDateInTz));
    }

    return isBefore(
      startOfDay(new Date(date.getTime()).toISOString()),
      startOfDay(earliestBackupDate),
    );
  }

  const resetState = useCallback(() => {
    setRestoreTargetTime(earliestBackupDate);
    setPermanentlyDeleteCurrentDataCheck(false);
    setCannotBeUndoneCheck(false);
    setIsRestoreScheduled(false);
    setRestoreTargetIsBeforeError(undefined);
  }, [earliestBackupDate]);

  const handleDateTimeChange = useCallback(
    (newDateTime: string | null) => {
      if (newDateTime !== null) {
        setRestoreTargetTime(newDateTime);
        if (isBefore(newDateTime, earliestBackupDate)) {
          setRestoreTargetIsBeforeError(
            'Selected date is before the earliest restore target time.',
          );
        } else {
          setRestoreTargetIsBeforeError(undefined);
        }
      }
    },
    [earliestBackupDate],
  );

  const handleOpenChange = useCallback(
    (newState: boolean) => {
      if (!newState) {
        resetState();
      }
      setOpen(newState);
    },
    [resetState],
  );

  const validateFn = useCallback(
    (newDateTime: Date) => {
      if (isBefore(newDateTime, earliestBackupDate)) {
        return 'Selected date and time is before the earliest available backup';
      }
      return '';
    },
    [earliestBackupDate],
  );

  const handleClose = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);
  const hasError = !!restoreTargetIsBeforeError;
  const startRestoreButtonDisabled =
    !(permanentlyDeleteCurrentDataCheck && cannotBeUndoneCheck) || hasError;

  const permanentlyDeleteCurrentDataCheckLabel = (
    <span>
      I understand that {operationCopy.confirmationActionText} this backup will
      permanently delete all current data for project <b>{project!.name}</b>.
    </span>
  );

  const dialogTitle = isRestoreScheduled
    ? 'Backup has been scheduled successfully.'
    : operationCopy.dialogTitle;
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>{operationCopy.triggerButtonText}</Button>
      </DialogTrigger>
      <DialogContent
        className="text-foreground sm:max-w-xl"
        disableOutsideClick
      >
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription />
        </DialogHeader>
        {isRestoreScheduled && (
          <BackupScheduledInfo
            onClose={handleClose}
            subdomain={project!.subdomain}
            orgSlug={org?.slug}
            operation={operation}
          />
        )}
        {!isRestoreScheduled && (
          <>
            <div className="flex w-full flex-col gap-9">
              <div className="flex flex-col gap-1">
                <p>Restore target time</p>
                <DateTimePicker
                  dateTime={restoreTargetTime}
                  formatDateFn={formatDateFn}
                  onDateTimeChange={handleDateTimeChange}
                  withTimezone
                  isCalendarDayDisabled={isCalendarDayDisabled}
                  validateDateFn={validateFn}
                  align="start"
                />
              </div>
              <div className="flex flex-col gap-3">
                <StartRestoreConfirmationCheck
                  checked={permanentlyDeleteCurrentDataCheck}
                  onCheckedChange={setPermanentlyDeleteCurrentDataCheck}
                  id="permanentlyDeleteCurrentDataCheck"
                  label={permanentlyDeleteCurrentDataCheckLabel}
                />
                <StartRestoreConfirmationCheck
                  checked={cannotBeUndoneCheck}
                  onCheckedChange={setCannotBeUndoneCheck}
                  id="cannotBeUndoneCheck"
                  label="I understand this cannot be undone"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                disabled={startRestoreButtonDisabled}
                loading={loading}
                onClick={handleRestore}
              >
                {operationCopy.submitButtonText}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RestoreBackupDialogButtonWrapper({
  earliestBackupDate,
  operation = 'restore',
  ...props
}: RestoreBackupDialogButtonWrapperProps) {
  if (isEmptyValue(earliestBackupDate)) {
    return (
      <Button disabled>
        {BACKUP_OPERATION_COPY[operation].pointInTime.triggerButtonText}
      </Button>
    );
  }

  return (
    <RestoreBackupDialogButton
      earliestBackupDate={earliestBackupDate!}
      operation={operation}
      {...props}
    />
  );
}

export default memo(RestoreBackupDialogButtonWrapper);
