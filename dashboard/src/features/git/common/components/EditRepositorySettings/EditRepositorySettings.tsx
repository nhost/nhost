import type { ConnectGitHubModalState } from '@/features/git/common/components/ConnectGitHubModal';
import { EditRepositorySettingsModal } from '@/features/git/common/components/EditRepositorySettingsModal';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { FormProvider, useForm } from 'react-hook-form';

export interface EditRepositorySettingsProps {
  close?: () => void;
  openConnectGithubModal?: () => void;
  selectedRepoId?: string;
  connectGithubModalState?: ConnectGitHubModalState;
  handleSelectAnotherRepository?: () => void;
}

export interface EditRepositorySettingsFormData {
  productionBranch: string;
  repoBaseFolder: string;
}

export default function EditRepositorySettings({
  close,
  selectedRepoId,
  handleSelectAnotherRepository,
}: EditRepositorySettingsProps) {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const form = useForm<EditRepositorySettingsFormData>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      productionBranch: currentProject?.repositoryProductionBranch || 'main',
      repoBaseFolder: currentProject?.nhostBaseFolder,
    },
  });

  return (
    <FormProvider {...form}>
      <EditRepositorySettingsModal
        close={close}
        selectedRepoId={selectedRepoId}
        handleSelectAnotherRepository={handleSelectAnotherRepository}
      />
    </FormProvider>
  );
}
