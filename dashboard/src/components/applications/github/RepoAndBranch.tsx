import type { EditRepositorySettingsFormData } from '@/components/applications/github/EditRepositorySettings';
import { useGetGithubRepositoriesQuery } from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Avatar } from '@/ui';
import DelayedLoading from '@/ui/DelayedLoading/DelayedLoading';
import { Input } from '@/ui/Input';
import { Text } from '@/ui/Text';
import { QuestionMarkCircleIcon } from '@heroicons/react/solid';
import Link from 'next/link';
import { Controller, useFormContext } from 'react-hook-form';

export function RepoAndBranch() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const { data, loading } = useGetGithubRepositoriesQuery();
  const { control } = useFormContext<EditRepositorySettingsFormData>();

  if (loading) {
    return <DelayedLoading delay={500} />;
  }

  const isTheRepositoryAlreadyConnected = currentApplication.githubRepository;
  const isThereAGithubAppInstallationAssociated =
    currentApplication.githubRepository
      ? currentApplication.githubRepository[0]?.githubAppInstallation
      : false;

  return (
    <div className="mb-2 flex w-full flex-col pb-1">
      {isTheRepositoryAlreadyConnected &&
        isThereAGithubAppInstallationAssociated && (
          <div className="mx-auto flex max-w-xs flex-row ">
            <Avatar
              name={
                data.githubRepositories[0].githubAppInstallation.accountLogin
              }
              avatarUrl={
                data.githubRepositories[0].githubAppInstallation
                  .accountAvatarUrl
              }
              className="h-7 w-7"
            />
            <div className="ml-2 self-center">
              <Text
                color="greyscaleDark"
                className="my-1 self-center font-medium"
                size="normal"
              >
                {currentApplication.githubRepository.fullName}
              </Text>
            </div>
          </div>
        )}
      <div className="mt-4 flex flex-col">
        <div className="flex flex-row place-content-between border-t border-b px-2 py-3">
          <div className="flex w-full flex-row">
            <Text
              color="greyscaleDark"
              className="self-center font-medium"
              size="normal"
            >
              Deployment Branch
            </Text>
          </div>
          <div className="flex w-full">
            <Controller
              name="productionBranch"
              control={control}
              rules={{
                required: true,
                pattern: {
                  value: /^[a-zA-Z0-9-_/]+$/,
                  message:
                    'Only alphanumeric characters, hyphens, underscores and slashes are allowed.',
                },
              }}
              render={({ field }) => (
                <Input
                  {...field}
                  id="productionBranch"
                  required
                  value={field.value || ''}
                  onChange={(value: string) => {
                    if (value && !/^[a-zA-Z0-9-_/]+$/gi.test(value)) {
                      return;
                    }
                    field.onChange(value);
                  }}
                />
              )}
            />
          </div>
        </div>
        <div className="flex flex-row place-content-between border-b px-2 py-3">
          <div className="flex w-full flex-row">
            <Text
              color="greyscaleDark"
              className="self-center font-medium"
              size="normal"
            >
              Base Directory
            </Text>
            <Link
              href="https://docs.nhost.io/platform/github-integration#base-directory"
              passHref
            >
              <a
                href="docs"
                className="self-center pl-2 text-blue"
                rel="noopener noreferrer"
                target="_blank"
              >
                <QuestionMarkCircleIcon className="h-3.5 w-3.5" />
              </a>
            </Link>
          </div>
          <div className="flex w-full">
            <Controller
              name="repoBaseFolder"
              control={control}
              rules={{
                required: true,
                pattern: {
                  value: /^[a-zA-Z0-9-_/.]+$/,
                  message: 'Must contain only letters, hyphens, and numbers.',
                },
              }}
              render={({ field }) => (
                <Input
                  {...field}
                  id="repoBaseFolder"
                  required
                  value={field.value || ''}
                  onChange={(value: string) => {
                    if (value && !/^[a-zA-Z0-9-_/.]+$/gi.test(value)) {
                      return;
                    }

                    field.onChange(value);
                  }}
                />
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default RepoAndBranch;
