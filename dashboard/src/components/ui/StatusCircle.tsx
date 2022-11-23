import clsx from 'clsx';

export type DeploymentStatus =
  | 'DEPLOYING'
  | 'DEPLOYED'
  | 'FAILED'
  | undefined
  | null;

type StatusCircleProps = {
  status: DeploymentStatus;
  className?: string;
};

export function StatusCircle(props: StatusCircleProps) {
  const { status, className } = props;

  const baseClasses = 'w-1.5 h-1.5 rounded-full';

  if (!status) {
    const classes = clsx(baseClasses, 'bg-gray-300', className);
    return <div className={classes} />;
  }

  if (status === 'DEPLOYING') {
    const classes = clsx(baseClasses, 'bg-yellow-300', className);
    return <div className={classes} />;
  }

  if (status === 'DEPLOYED') {
    const classes = clsx(baseClasses, 'bg-green-300', className);
    return <div className={classes} />;
  }

  if (status === 'FAILED') {
    const classes = clsx(baseClasses, 'bg-red', className);
    return <div className={classes} />;
  }

  return null;
}

export default StatusCircle;
