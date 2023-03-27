import { twMerge } from 'tailwind-merge';
import Box from './v2/Box';

export type DeploymentStatus =
  | 'DEPLOYING'
  | 'DEPLOYED'
  | 'FAILED'
  | 'PENDING'
  | 'SCHEDULED'
  | undefined
  | null;

type StatusCircleProps = {
  status: DeploymentStatus;
};

export function StatusCircle({ status }: StatusCircleProps) {
  const baseClasses = 'w-1.5 h-1.5 rounded-full';

  if (status === 'DEPLOYING' || status === 'PENDING') {
    return (
      <Box
        className={twMerge(baseClasses, 'animate-pulse')}
        sx={{ backgroundColor: 'warning.main' }}
      />
    );
  }

  if (status === 'DEPLOYED') {
    return (
      <Box className={baseClasses} sx={{ backgroundColor: 'success.main' }} />
    );
  }

  if (status === 'FAILED') {
    return (
      <Box className={baseClasses} sx={{ backgroundColor: 'error.main' }} />
    );
  }

  return <Box className={baseClasses} sx={{ backgroundColor: 'grey.500' }} />;
}

export default StatusCircle;
