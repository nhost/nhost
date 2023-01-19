import { twMerge } from 'tailwind-merge';

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
  className?: string;
};

export function StatusCircle({ status, className }: StatusCircleProps) {
  const baseClasses = 'w-1.5 h-1.5 rounded-full';

  if (status === 'DEPLOYING' || status === 'PENDING') {
    return (
      <div
        className={twMerge(
          baseClasses,
          'bg-yellow-300 animate-pulse',
          className,
        )}
      />
    );
  }

  if (status === 'DEPLOYED') {
    return <div className={twMerge(baseClasses, 'bg-green-300', className)} />;
  }

  if (status === 'FAILED') {
    return <div className={twMerge(baseClasses, 'bg-red', className)} />;
  }

  return <div className={twMerge(baseClasses, 'bg-gray-300', className)} />;
}

export default StatusCircle;
