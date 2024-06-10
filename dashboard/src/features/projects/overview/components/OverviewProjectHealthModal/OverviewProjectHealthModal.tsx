import { CodeBlock } from '@/components/presentational/CodeBlock';
import { Accordion } from '@/components/ui/v2/Accordion';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Checkbox } from '@/components/ui/v2/Checkbox';
import { Text } from '@/components/ui/v2/Text';
import { ChevronDownIcon } from '@/components/ui/v2/icons/ChevronDownIcon';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import { XIcon } from '@/components/ui/v2/icons/XIcon';
import type { GetProjectServicesHealthQuery } from '@/utils/__generated__/graphql';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';

const testCode = {
  "data": {
    "project": {
      "services": {
        "edges": [
          {
            "node": {
              "name": "service1",
              "health": "HEALTHY",
              "logs": [
                {
                  "message": "Service is healthy",
                  "timestamp": "2021-08-12T10:00:00Z"
                }
              ]
            }
          }
        ]
      }
    }
  }
};

export interface OverviewProjectHealthModalProps {
  close: () => void;
  servicesHealth?: GetProjectServicesHealthQuery;
}

function ServiceAccordion() {

  return (
    <Accordion.Root>
      <Accordion.Summary
        expandIcon={<ChevronDownIcon className="text-black" />}
        aria-controls="panel1-content"
        id="panel1-header"
      >
        <div className="flex justify-between flex-row gap-2">
          <div className="flex items-center gap-3">
            <UserIcon className="w-4 h-4" />
            <Text sx={{ color: "text.primary" }} variant="h4" className="font-semibold">
              Auth <Text sx={{
                color: "text.secondary"
              }} component="span" className="font-semibold">(2 replicas)</Text></Text>
            <Box sx={{
              backgroundColor: 'error.main',
            }} className="rounded-full w-2 h-2" />
          </div>
        </div>
      </Accordion.Summary>
      <Accordion.Details>
        <CodeBlock
          code=""
        >
          {JSON.stringify(testCode, null, 2)}
        </CodeBlock>
      </Accordion.Details>

    </Accordion.Root>
  )
}

export default function OverviewProjectHealthModal({
  close,
  servicesHealth,
}: OverviewProjectHealthModalProps) {
  const [remove, setRemove] = useState(false);
  const [loadingRemove, setLoadingRemove] = useState(false);

  async function handleClick() {
    setLoadingRemove(true);

    // await execPromiseWithErrorToast(deleteAssistant, {
    //   loadingMessage: 'Deleting the assistant...',
    //   successMessage: 'The Assistant has been deleted successfully.',
    //   errorMessage:
    //     'An error occurred while deleting the Assistant. Please try again.',
    // });
  }


  return (<Box className={twMerge('w-full rounded-lg p-6 text-left')}>
    <div className="grid grid-flow-row gap-1">
      <Box className="flex justify-center items-center gap-4">
        <Button
          variant="borderless"
          color="secondary"
          className="absolute right-4 top-5"
          size="small"
          aria-label="Close"
          onClick={close}
          sx={{ padding: (theme) => theme.spacing(0.5), minWidth: 'initial' }}
        >
          <XIcon fontSize="small" />
        </Button>
      </Box>
      <ServiceAccordion />
      <ServiceAccordion />
      <ServiceAccordion />
      <ServiceAccordion />
      <ServiceAccordion />
    </div>
  </Box>
  );
}