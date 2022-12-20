import ConnectGithubModal from '@/components/applications/ConnectGithubModal';
import { FunctionsNotDeployed } from '@/components/applications/functions/FunctionsNotDeployed';
import { normalizeFunctionMetadata } from '@/components/applications/functions/normalizeFunctionMetadata';
import { EditRepositorySettings } from '@/components/applications/github/EditRepositorySettings';
import useGitHubModal from '@/components/applications/github/useGitHubModal';
import Folder from '@/components/icons/Folder';
import Container from '@/components/layout/Container';
import ProjectLayout from '@/components/layout/ProjectLayout';
import { useWorkspaceContext } from '@/context/workspace-context';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Button } from '@/ui/Button';
import DelayedLoading from '@/ui/DelayedLoading';
import { Modal } from '@/ui/Modal';
import Status, { StatusEnum } from '@/ui/Status';
import { Text } from '@/ui/Text';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import { useGetAppFunctionsMetadataQuery } from '@/utils/__generated__/graphql';
import { ChevronRightIcon } from '@heroicons/react/solid';
import clsx from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

function FunctionsNoRepo() {
  const [githubModal, setGithubModal] = useState(false);
  const [githubRepoModal, setGithubRepoModal] = useState(false);
  const { openGitHubModal } = useGitHubModal();

  return (
    <>
      <Modal showModal={githubModal} close={() => setGithubModal(!githubModal)}>
        <ConnectGithubModal close={() => setGithubModal(false)} />
      </Modal>
      <Modal
        showModal={githubRepoModal}
        close={() => setGithubRepoModal(!githubRepoModal)}
      >
        <EditRepositorySettings
          openConnectGithubModal={() => setGithubModal(true)}
          close={() => setGithubRepoModal(false)}
          handleSelectAnotherRepository={openGitHubModal}
        />
      </Modal>
      <div className="mx-auto flex w-centImage flex-col text-center">
        <Image
          src="/assets/githubRepo.svg"
          width={72}
          height={72}
          alt="GitHub Logo"
        />
      </div>
      <Text className="mt-4 font-medium" size="large" color="dark">
        Function Logs
      </Text>
      <div className="flex">
        <div className="mx-auto flex flex-row self-center text-center">
          <Text size="normal" color="greyscaleDark" className="mt-1">
            To deploy serverless functions, you need to connect your project to
            version control.
          </Text>
        </div>
      </div>
      <div className="mt-3 flex text-center">
        <Button
          transparent
          color="blue"
          className="mx-auto font-medium"
          onClick={() => setGithubModal(true)}
        >
          Connect your Project to GitHub
        </Button>
      </div>
    </>
  );
}

export default function FunctionsPage() {
  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();
  const { workspaceContext } = useWorkspaceContext();

  const { data, loading, error } = useGetAppFunctionsMetadataQuery({
    variables: { id: currentApplication?.id },
  });

  const [normalizedFunctions, setNormalizedFunctions] = useState(null);

  useEffect(() => {
    if (!data) {
      return;
    }
    if (data.app.metadataFunctions) {
      setNormalizedFunctions(
        normalizeFunctionMetadata(data.app.metadataFunctions),
      );
    }
  }, [data]);

  if (!workspaceContext.repository) {
    return (
      <Container className="mt-12 max-w-3xl text-center antialiased">
        <FunctionsNoRepo />
      </Container>
    );
  }

  if (loading) {
    return (
      <Container>
        <DelayedLoading delay={500} className="mt-12" />
      </Container>
    );
  }

  if (!data || normalizedFunctions === null) {
    return (
      <Container>
        <FunctionsNotDeployed />
      </Container>
    );
  }

  if (error) {
    return <Container>Error</Container>;
  }

  return (
    <Container>
      <div className="mt-2">
        {normalizedFunctions?.map((folder) => (
          <div key={folder.folder}>
            <div
              className={clsx(
                'flex flex-row pt-8 pb-2 align-middle',
                folder.nestedLevel < 2 && 'ml-6',
                folder.nestedLevel >= 2 && 'ml-12',
              )}
            >
              <div className={clsx('flex w-full')}>
                {folder.nestedLevel > 0 && (
                  <Folder className="self-center align-middle text-greyscaleGrey" />
                )}
                <Text
                  color="greyscaleDark"
                  variant="body"
                  className={clsx(
                    'font-medium',
                    folder.nestedLevel > 0 && 'ml-2',
                  )}
                  size="tiny"
                >
                  {folder.folder}/
                </Text>
              </div>
              {folder.nestedLevel === 0 ? (
                <div className="flex w-full flex-row">
                  <div className="flex w-52">
                    <Text
                      color="greyscaleDark"
                      variant="body"
                      className="font-medium"
                      size="tiny"
                    >
                      Created At
                    </Text>
                  </div>
                  <div className="flex w-16 self-end">
                    <Text
                      color="greyscaleDark"
                      variant="body"
                      className="font-medium"
                      size="tiny"
                    >
                      Status
                    </Text>
                  </div>
                </div>
              ) : null}
            </div>
            <div
              className={clsx(
                'border-t py-1',
                folder.nestedLevel < 2 && 'ml-6',
                folder.nestedLevel >= 2 && 'ml-12',
              )}
            >
              {folder.funcs.map((func) => (
                <Link
                  key={func.id}
                  href={{
                    pathname:
                      '/[workspaceSlug]/[appSlug]/functions/[functionId]',
                    query: {
                      workspaceSlug: currentWorkspace.slug,
                      appSlug: currentApplication.slug,
                      functionId: func.functionName,
                    },
                  }}
                  passHref
                >
                  <a
                    href="[workspaceSlug]/[appSlug]/functions/[functionId]"
                    className={clsx(
                      'flex cursor-pointer flex-row border-b py-2.5',
                      folder.nestedLevel && 'ml-0',
                    )}
                  >
                    <div className="flex w-full flex-row items-center">
                      <Image
                        src={`/assets/functions/${func.lang}.svg`}
                        alt={`Logo of ${func.lang}`}
                        width={16}
                        height={16}
                      />

                      <Text
                        color="greyscaleDark"
                        variant="body"
                        className="pl-2 font-medium"
                        size="small"
                      >
                        {func.name}
                      </Text>
                    </div>
                    <div className="flex w-full flex-row">
                      <div className={clsx('flex w-52 self-center')}>
                        <Text
                          color="greyscaleDark"
                          variant="body"
                          className=""
                          size="tiny"
                        >
                          {func.formattedCreatedAt || '-'}
                        </Text>
                      </div>
                      <div className="flex w-16 self-center">
                        <Status status={StatusEnum.Live}>Live</Status>

                        <ChevronRightIcon className="middl ml-2 h-4 w-4 cursor-pointer self-center" />
                      </div>
                    </div>
                  </a>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-6xl">
        <div className="text-center">
          <Text size="tiny" color="greyscaleDark" className="font-medium">
            Base URL for function endpoints is{' '}
            {generateAppServiceUrl(
              currentApplication.subdomain,
              currentApplication.region.awsName,
              'functions',
            )}
          </Text>
        </div>
      </div>
    </Container>
  );
}

FunctionsPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
