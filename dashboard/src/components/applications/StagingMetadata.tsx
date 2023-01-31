import Status, { StatusEnum } from '@/ui/Status';
import Box from '@/ui/v2/Box';
import { isDevOrStaging } from '@/utils/helpers';
import type { PropsWithChildren } from 'react';

export function StagingMetadata({ children }: PropsWithChildren<unknown>) {
  return (
    isDevOrStaging() && (
      <div className="mt-10">
        <Box className="mx-auto flex flex-col rounded-md border p-5 text-center">
          <Status status={StatusEnum.Deploying}>Internal info</Status>
          {children}
        </Box>
      </div>
    )
  );
}

export default StagingMetadata;
