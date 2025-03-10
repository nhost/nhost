import { DateTimePicker } from '@/components/common/DateTimePicker';
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
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { TZDate } from '@date-fns/tz';
import { DialogDescription } from '@radix-ui/react-dialog';
import { format, isBefore, startOfDay } from 'date-fns-v4';
import { memo, useEffect, useState } from 'react';
import StartRestoreConfirmationCheck from './StartRestoreConfirmationCheck';

interface Props {
  fromAppId?: string;
  title: string;
  earliestBackupDate: string;
  disabled?: boolean;
}

function RestoreBackupDialogButton({
  title,
  disabled,
  earliestBackupDate,
  fromAppId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isRestoreScheduled, setIsRestoreScheduled] = useState(false);

  const [restoreTargetTime, setRestoreTargetTime] =
    useState(earliestBackupDate);

  const [
    permanentlyDeleteCurrentDataCheck,
    setPermanentlyDeleteCurrentDataCheck,
  ] = useState(false);
  const [cannotBeUndoneCheck, setCannotBeUndoneCheck] = useState(false);

  const { project } = useProject();

  const {
    restoreApplicationDatabaseMock: restoreApplicationDatabase,
    mockLoading: loading,
  } = useRestoreApplicationDatabasePiTR();

  async function handleRestore() {
    const variables = {
      appId: project?.id,
      recoveryTarget: restoreTargetTime,
      ...(fromAppId !== project?.id && { fromAppId }),
    };
    restoreApplicationDatabase(variables, () => setIsRestoreScheduled(true));
  }

  useEffect(() => {
    if (earliestBackupDate) {
      setRestoreTargetTime(earliestBackupDate);
    }
  }, [earliestBackupDate]);

  function formatDateFn(date: Date | TZDate) {
    return format(date, 'dd MMM yyyy, HH:mm:ss (OOOO)').replace('GMT', 'UTC');
  }

  function isCalendarDayDisabled(date: Date) {
    return isBefore(startOfDay(date), startOfDay(earliestBackupDate));
  }

  function resetState() {
    setRestoreTargetTime(earliestBackupDate);
    setPermanentlyDeleteCurrentDataCheck(false);
    setCannotBeUndoneCheck(false);
    setIsRestoreScheduled(false);
  }

  function handleOpenChange(newState: boolean) {
    if (!newState) {
      resetState();
    }
    setOpen(newState);
  }

  const startRestoreButtonDisabled = !(
    permanentlyDeleteCurrentDataCheck && cannotBeUndoneCheck
  );

  const permanentlyDeleteCurrentDataCheckLabel = (
    <span>
      I understand that restoring this backup will permanently delete all
      current data for project <b>{project.name}</b>.
    </span>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>Start restore</Button>
      </DialogTrigger>
      <DialogContent
        className="text-foreground sm:max-w-xl"
        disableOutsideClick
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription />
        </DialogHeader>
        {isRestoreScheduled && <h1>Hello there</h1>}
        <div className="flex w-full flex-col gap-10">
          <div className="flex flex-col gap-1">
            <p>Restore target time</p>
            <DateTimePicker
              dateTime={restoreTargetTime}
              formatDateFn={formatDateFn}
              onDateTimeChange={setRestoreTargetTime}
              withTimezone
              isCalendarDayDisabled={isCalendarDayDisabled}
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
              label="I understand this can not be undone"
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
            Restore backup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default memo(RestoreBackupDialogButton);
