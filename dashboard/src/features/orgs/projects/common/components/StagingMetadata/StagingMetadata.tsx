import type { PropsWithChildren } from 'react';
import { Badge } from '@/components/ui/v3/badge';
import { isDevOrStaging } from '@/utils/helpers';

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
    return (
      <Badge
        variant="outline"
        className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      >
        {children}
      </Badge>
    );
  }

  if (status === StatusEnum.Live) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      >
        {children}
      </Badge>
    );
  }

  if (status === StatusEnum.Plan) {
    return (
      <Badge
        variant="outline"
        className="border-primary/30 bg-primary/10 text-primary"
      >
        {children}
      </Badge>
    );
  }

  if (status === StatusEnum.Soon) {
    return (
      <Badge
        variant="outline"
        className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
      >
        {children}
      </Badge>
    );
  }

  if (status === StatusEnum.Error) {
    return <Badge variant="destructive">{children}</Badge>;
  }

  return <Badge variant="secondary">{children}</Badge>;
}

export default function StagingMetadata({
  children,
}: PropsWithChildren<unknown>) {
  return (
    isDevOrStaging() && (
      <div className="mx-auto max-w-sm">
        <div className="mx-auto grid grid-flow-row justify-items-center rounded-md border p-5 text-center text-foreground">
          <Status status={StatusEnum.Deploying}>Internal info</Status>
          {children}
        </div>
      </div>
    )
  );
}
