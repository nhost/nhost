import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Status, { StatusEnum } from '@/ui/Status';
import { Text } from '@/ui/Text';
import Image from 'next/image';
import Link from 'next/link';

function AllWorkspaceApps() {
  const { currentWorkspace } = useCurrentWorkspaceAndApplication();
  const noApplications = currentWorkspace?.applications.length === 0;
  return (
    <div className="divide-y-1 divide-divide border-t-1 border-b-1 border-divide">
      {noApplications ? (
        <div className="flex flex-row px-1 py-4">
          <Text size="tiny" className="self-center" color="greyscaleGrey">
            No projects on this workspace.
          </Text>
        </div>
      ) : (
        <div>
          {currentWorkspace?.applications.map((app) => (
            <Link
              key={app.id}
              href={`${currentWorkspace?.slug}/${app.slug}`}
              passHref
            >
              <div className="flex cursor-pointer py-4">
                <div className="flex w-full flex-row place-content-between px-1">
                  <div className="flex flex-row">
                    <div className="inline-block h-8 w-8 overflow-hidden rounded-lg">
                      <Image
                        src="/logos/new.svg"
                        alt="Nhost Logo"
                        width={32}
                        height={32}
                      />
                    </div>
                    <Text
                      color="greyscaleDark"
                      variant="a"
                      size="normal"
                      className="ml-2 self-center font-medium"
                    >
                      {app.name}
                    </Text>
                  </div>
                  <div className="flex">
                    <Status status={StatusEnum.Plan}>{app.plan.name}</Status>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
export default function WorkspaceApps() {
  const { currentWorkspace } = useCurrentWorkspaceAndApplication();

  return (
    <div className="mt-9">
      <div className="mx-auto max-w-3xl font-display">
        <div className="mb-4 flex flex-row place-content-between">
          <Text
            variant="body"
            size="large"
            color="greyscaleDark"
            className="font-medium"
          >
            Projects
          </Text>
          <Link
            key={currentWorkspace.id}
            href={{
              pathname: '/new',
              query: { workspace: currentWorkspace.slug },
            }}
            passHref
          >
            New Project
          </Link>
        </div>

        <AllWorkspaceApps />
      </div>
    </div>
  );
}
