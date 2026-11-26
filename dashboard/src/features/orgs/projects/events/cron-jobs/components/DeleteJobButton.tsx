import { Trash2 } from 'lucide-react';
import JobIconButton from '@/features/orgs/projects/events/cron-jobs/components/JobIconButton';

export default function DeleteJobButton({
  onClick,
  disabled,
}: {
  onClick: VoidFunction;
  disabled?: boolean;
}) {
  return (
    <JobIconButton
      label="Delete job"
      destructive
      disabled={disabled}
      onClick={onClick}
    >
      <Trash2 />
    </JobIconButton>
  );
}
