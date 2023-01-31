import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Status, { StatusEnum } from '@/ui/Status';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import PlusCircleIcon from '@/ui/v2/icons/PlusCircleIcon';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import Image from 'next/image';
import NavLink from 'next/link';
import { Fragment } from 'react';

function AllWorkspaceApps() {
  const { currentWorkspace } = useCurrentWorkspaceAndApplication();
  const noApplications = currentWorkspace?.applications.length === 0;

  if (noApplications) {
    return (
      <Box className="flex flex-row border-y py-4">
        <Text className="text-xs" color="secondary">
          No projects on this workspace.
        </Text>
      </Box>
    );
  }

  return (
    <List>
      <Divider component="li" />

      {currentWorkspace?.applications.map((app) => (
        <Fragment key={app.id}>
          <ListItem.Root>
            <NavLink href={`${currentWorkspace?.slug}/${app.slug}`} passHref>
              <ListItem.Button className="grid grid-flow-col justify-between gap-2">
                <div className="grid grid-flow-col items-center gap-2">
                  <div className="h-8 w-8 overflow-hidden rounded-lg">
                    <Image
                      src="/logos/new.svg"
                      alt="Nhost Logo"
                      width={32}
                      height={32}
                    />
                  </div>

                  <Text className="font-medium">{app.name}</Text>
                </div>

                <Status status={StatusEnum.Plan}>{app.plan.name}</Status>
              </ListItem.Button>
            </NavLink>
          </ListItem.Root>

          <Divider component="li" />
        </Fragment>
      ))}
    </List>
  );
}
export default function WorkspaceApps() {
  const { currentWorkspace } = useCurrentWorkspaceAndApplication();

  return (
    <div className="mt-9">
      <div className="mx-auto max-w-3xl font-display">
        <div className="mb-4 flex flex-row place-content-between">
          <Text className="text-lg font-medium">Projects</Text>
          <NavLink
            href={{
              pathname: '/new',
              query: { workspace: currentWorkspace.slug },
            }}
          >
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<PlusCircleIcon />}
            >
              New Project
            </Button>
          </NavLink>
        </div>

        <AllWorkspaceApps />
      </div>
    </div>
  );
}
