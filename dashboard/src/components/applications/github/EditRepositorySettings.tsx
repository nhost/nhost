import type { ConnectGithubModalState } from '@/components/applications/ConnectGithubModal';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/useCurrentWorkspaceAndProject';
import { FormProvider, useForm } from 'react-hook-form';
import { EditRepositorySettingsModal } from './EditRepositorySettingsModal';

export interface EditRepositorySettingsProps {
  close?: () => void;
  openConnectGithubModal?: () => void;
  selectedRepoId?: string;
  connectGithubModalState?: ConnectGithubModalState;
  handleSelectAnotherRepository?: () => void;
}

export interface EditRepositorySettingsFormData {
  productionBranch: string;
  repoBaseFolder: string;
}

export function EditRepositorySettings({
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
