import clsx from 'clsx';

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
  return (
    <div
      className={clsx(
        'flex self-center rounded-2xl bg-opacity-20 py-0.5 px-2 align-middle text-xs font-medium',
        status === StatusEnum.Closed && 'bg-greyscaleGrey text-greyscaleDark',
        (status === StatusEnum.Deploying || status === StatusEnum.Medium) &&
          'bg-lightOrange text-orange',
        status === StatusEnum.Live && 'bg-live text-greenDark',
        status === StatusEnum.Error && 'bg-lightRed text-red',
        status === StatusEnum.Plan && 'bg-blue text-white',
        status === StatusEnum.Soon && 'bg-lightBlue text-blue',
        status === StatusEnum.Paused && 'bg-greyscaleGrey text-greyscaleDark',
      )}
    >
      <span className="font-display text-xs font-medium">{children}</span>
    </div>
  );
}
