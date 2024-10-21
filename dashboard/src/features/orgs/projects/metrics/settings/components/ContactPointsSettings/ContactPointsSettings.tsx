import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';

import type { Role } from '@/types/application';
import {
  GetRolesPermissionsDocument,
  useGetObservabilitySettingsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { twMerge } from 'tailwind-merge';

import { Button } from '@/components/ui/v2/Button';
import { CubeIcon } from '@/components/ui/v2/icons/CubeIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import * as Yup from 'yup';
import { ContactPointForm } from '../ContactPointForm';

export const validationSchema = Yup.object({
  emails: Yup.array().of(
    Yup.string().email('Invalid email address').required(),
  ),
});

type ContactPointsEmailFormValues = Yup.InferType<typeof validationSchema>;

export default function ContactPointsEmailSettings() {
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();
  const { openDrawer, openAlertDialog, openDialog } = useDialog();

  const { data, loading, error, refetch } = useGetObservabilitySettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { emails } = data?.config?.observability?.grafana?.contacts || {};

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetRolesPermissionsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (loading) {
    return <ActivityIndicator delay={1000} label="Loading user roles..." />;
  }

  if (error) {
    throw error;
  }

  async function showApplyChangesDialog() {
    if (!isPlatform) {
      openDialog({
        title: 'Apply your changes',
        component: <ApplyLocalSettingsDialog />,
        props: {
          PaperProps: {
            className: 'max-w-2xl',
          },
        },
      });
    }
  }

  const initialData = { emails };

  const openCreateContactPointDialog = () => {
    // creating services using the local dashboard is not supported
    if (!isPlatform) {
      return;
    }

    openDrawer({
      title: (
        <Box className="flex flex-row items-center space-x-2">
          <CubeIcon className="h-5 w-5" />
          <Text>Edit contact points</Text>
        </Box>
      ),
      component: (
        <ContactPointForm initialData={initialData} onSubmit={refetch} />
      ),
    });
  };

  async function handleDeleteRole({ name }: Role) {}

  const handleSubmit = async (values: ContactPointsEmailFormValues) => {
    console.log(values);
  };

  return (
    <SettingsContainer
      title="Contact Points"
      description="Select your preferred emails for receiving notifications when your alert rules are firing."
      docsLink="https://docs.nhost.io/platform/metrics#configure-contact-points"
      rootClassName="gap-0"
      className={twMerge('my-2 px-0')}
    >
      <Box className="border-b-1 px-4 py-3">
        <Text className="font-medium">Emails</Text>
      </Box>
      <Box className="px-4 py-3">
        <Button
          variant="contained"
          color="primary"
          onClick={openCreateContactPointDialog}
          startIcon={<PlusIcon className="h-4 w-4" />}
          disabled={!isPlatform}
        >
          Add more contact points
        </Button>
      </Box>
    </SettingsContainer>
  );
}
