import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import type { ConnectGitHubModalState } from '@/features/projects/git/common/components/ConnectGitHubModal';
import { EditRepositorySettingsModal } from '@/features/projects/git/common/components/EditRepositorySettingsModal';
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
