import Chip from './v2/Chip';

interface StatusProps {
  status: StatusEnum;
  children: string;
}

export enum StatusEnum {
  Live = 'Live',
  Deploying = 'Deploying',
  Medium = 'Medium',
  Closed = 'Closed',
  Plan = 'Plan',
  Soon = 'Soon',
  Error = 'Error',
  Paused = 'Paused',
}

export default function Status({
  children,
  status = StatusEnum.Live,
}: StatusProps) {
  if (status === StatusEnum.Deploying || status === StatusEnum.Medium) {
    return <Chip color="warning" size="small" label={children} />;
  }

  if (status === StatusEnum.Live) {
    return <Chip color="success" size="small" label={children} />;
  }

  if (status === StatusEnum.Plan) {
    return <Chip color="primary" size="small" label={children} />;
  }

  if (status === StatusEnum.Soon) {
    return <Chip color="info" size="small" label={children} />;
  }

  if (status === StatusEnum.Error) {
    return <Chip color="error" size="small" label={children} />;
  }

  return <Chip color="default" size="small" label={children} />;

  // return (
  //   <div
  //     className={clsx(
  //       'flex self-center rounded-2xl bg-opacity-20 py-0.5 px-2 align-middle text-xs font-medium',
  //       status === StatusEnum.Closed && 'bg-greyscaleGrey text-greyscaleDark',

  //       status === StatusEnum.Error && 'bg-lightRed text-red',
  //       // status === StatusEnum.Plan && 'bg-blue text-white',
  //       // status === StatusEnum.Soon && 'bg-lightBlue text-blue',
  //       status === StatusEnum.Paused && 'bg-greyscaleGrey text-greyscaleDark',
  //     )}
  //   >
  //     <span className="font-display text-xs font-medium">{children}</span>
  //   </div>
  // );
}
