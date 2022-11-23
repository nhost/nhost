import type { ConnectGithubModalState } from '@/components/applications/ConnectGithubModal';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
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
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const form = useForm<EditRepositorySettingsFormData>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      productionBranch: currentApplication.repositoryProductionBranch || 'main',
      repoBaseFolder: currentApplication.nhostBaseFolder,
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
