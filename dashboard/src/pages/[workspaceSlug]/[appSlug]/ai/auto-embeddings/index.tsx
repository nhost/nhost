import { useDialog } from '@/components/common/DialogProvider';
import AILayout from '@/components/layout/AILayout/AILayout';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { CubeIcon } from '@/components/ui/v2/icons/CubeIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { Text } from '@/components/ui/v2/Text';
import { type ReactElement } from 'react';

export default function AutoEmbeddingsPage() {
  const { openDrawer } = useDialog();

  const openCreateServiceDialog = () => {
    openDrawer({
      title: (
        <Box className="flex flex-row items-center space-x-2">
          <CubeIcon className="h-5 w-5" />
          <Text>Create a new service</Text>
        </Box>
      ),
      component: <ServiceForm onSubmit={refetchServices} />,
    });
  };

  return (
    <Box className="flex flex-col overflow-hidden">
      <Box className="flex flex-row place-content-end border-b-1 p-4">
        <Button
          variant="contained"
          color="primary"
          onClick={openCreateServiceDialog}
          startIcon={<PlusIcon className="h-4 w-4" />}
        >
          New
        </Button>
      </Box>
    </Box>
  );
}

AutoEmbeddingsPage.getLayout = function getLayout(page: ReactElement) {
  return <AILayout>{page}</AILayout>;
};
