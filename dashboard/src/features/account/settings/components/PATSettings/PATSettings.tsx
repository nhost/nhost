import { useDialog } from '@/components/common/DialogProvider';
import { SettingsContainer } from '@/components/settings/SettingsContainer';
import { useUI } from '@/context/UIContext';
import { CreatePATForm } from '@/features/account/settings/components/CreatePATForm';
import { ActivityIndicator } from '@/ui/v2/ActivityIndicator';
import { Box } from '@/ui/v2/Box';
import { Button } from '@/ui/v2/Button';
import { List } from '@/ui/v2/List';
import { Text } from '@/ui/v2/Text';
import { PlusIcon } from '@/ui/v2/icons/PlusIcon';
import { useGetPersonalAccessTokensQuery } from '@/utils/__generated__/graphql';
import { twMerge } from 'tailwind-merge';

export default function PATSettings() {
  const { maintenanceActive } = useUI();
  const { openDialog } = useDialog();

  const availablePersonalAccessTokens = [];

  const { data, loading } = useGetPersonalAccessTokensQuery({
    fetchPolicy: 'cache-only',
  });

  console.log(data.personalAccessTokens);

  function handleOpenCreator() {
    openDialog({
      title: 'Create Personal Access Token',
      component: <CreatePATForm />,
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'gap-2 max-w-sm' },
      },
    });
  }

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading personal access tokens..."
      />
    );
  }

  return (
    <SettingsContainer
      title="Personal Access Tokens"
      description="Personal access tokens are unique authorization keys that grant individuals access to specific resources and services within a system or platform."
      rootClassName="gap-0"
      className={twMerge(
        'my-2 px-0',
        availablePersonalAccessTokens.length === 0 && 'gap-2',
      )}
      slotProps={{ submitButton: { className: 'hidden' } }}
    >
      <Box className="grid grid-cols-2 gap-2 border-b-1 px-4 py-3 lg:grid-cols-3">
        <Text className="font-medium">Name</Text>
      </Box>

      <Box className="grid grid-flow-row gap-2">
        {availablePersonalAccessTokens.length > 0 && <List>Yoo</List>}

        <Button
          className="mx-4 justify-self-start"
          variant="borderless"
          startIcon={<PlusIcon />}
          onClick={handleOpenCreator}
          disabled={maintenanceActive}
        >
          Create Personal Access Token
        </Button>
      </Box>
    </SettingsContainer>
  );
}
