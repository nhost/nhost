import type { ConnectGitHubModalState } from '@/features/orgs/projects/git/common/components/ConnectGitHubModal';
import { EditRepositorySettingsModal } from '@/features/orgs/projects/git/common/components/EditRepositorySettingsModal';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
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
  const { project } = useProject();

  const form = useForm<EditRepositorySettingsFormData>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      productionBranch: project?.repositoryProductionBranch || 'main',
      repoBaseFolder: project?.nhostBaseFolder,
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
