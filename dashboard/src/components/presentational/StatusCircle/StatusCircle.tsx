import { twMerge } from 'tailwind-merge';
import { Box } from '@/components/ui/v2/Box';

export type PipelineRunStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'aborted'
  | undefined
  | null;

export type StatusCircleProps = {
  status: PipelineRunStatus;
};

export default function StatusCircle({ status }: StatusCircleProps) {
  const baseClasses = 'w-1.5 h-1.5 rounded-full';

  if (status === 'running' || status === 'pending') {
    return (
      <Box
        className={twMerge(baseClasses, 'animate-pulse')}
        sx={{ backgroundColor: 'warning.main' }}
      />
    );
  }

  if (status === 'succeeded') {
    return (
      <Box className={baseClasses} sx={{ backgroundColor: 'success.main' }} />
    );
  }

  if (status === 'failed') {
    return (
      <Box className={baseClasses} sx={{ backgroundColor: 'error.main' }} />
    );
  }

  return <Box className={baseClasses} sx={{ backgroundColor: 'grey.500' }} />;
}
