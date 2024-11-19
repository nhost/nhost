import { Box } from '@/components/ui/v2/Box';
import { Chip } from '@/components/ui/v2/Chip';
import { isDevOrStaging } from '@/utils/helpers';
import type { PropsWithChildren } from 'react';

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

function Status({ children, status = StatusEnum.Live }: StatusProps) {
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
}

export default function StagingMetadata({
  children,
}: PropsWithChildren<unknown>) {
  return (
    isDevOrStaging() && (
      <div className="mx-auto max-w-sm">
        <Box className="mx-auto grid grid-flow-row justify-items-center rounded-md border p-5 text-center">
          <Status status={StatusEnum.Deploying}>Internal info</Status>
          {children}
        </Box>
      </div>
    )
  );
}
