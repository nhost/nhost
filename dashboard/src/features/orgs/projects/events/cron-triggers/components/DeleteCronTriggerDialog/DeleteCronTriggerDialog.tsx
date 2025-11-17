export interface DeleteCronTriggerDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  cronTriggerToDelete: string;
}

export default function DeleteCronTriggerDialog({
  open,
  setOpen,
  cronTriggerToDelete,
}: DeleteCronTriggerDialogProps) {
  return <div />;
}
