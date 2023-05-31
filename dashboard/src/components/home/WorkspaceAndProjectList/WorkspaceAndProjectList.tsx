import { StateBadge } from '@/components/common/StateBadge';
import type { DeploymentStatus } from '@/components/common/StatusCircle';
import { StatusCircle } from '@/components/common/StatusCircle';
import { useUI } from '@/components/common/UIProvider';
import { DeploymentStatusMessage } from '@/features/projects/deployments/components/DeploymentStatusMessage';
import type { ApplicationState, Workspace } from '@/types/application';
import { ApplicationStatus } from '@/types/application';
import type { BoxProps } from '@/ui/v2/Box';
import { Box } from '@/ui/v2/Box';
import type { ButtonProps } from '@/ui/v2/Button';
import { Button } from '@/ui/v2/Button';
import { Divider } from '@/ui/v2/Divider';
import { PlusCircleIcon } from '@/ui/v2/icons/PlusCircleIcon';
import { SearchIcon } from '@/ui/v2/icons/SearchIcon';
import type { InputProps } from '@/ui/v2/Input';
import { Input } from '@/ui/v2/Input';
import { Link } from '@/ui/v2/Link';
import { List } from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import { Text } from '@/ui/v2/Text';
import { getApplicationStatusString } from '@/utils/helpers';
import debounce from 'lodash.debounce';
import Image from 'next/image';
import NavLink from 'next/link';
import type { ChangeEvent, PropsWithoutRef } from 'react';
import { Fragment, useState } from 'react';
import { twMerge } from 'tailwind-merge';

export interface WorkspaceAndProjectListProps extends BoxProps {
  /**
   * List of workspaces to be displayed.
   */
  workspaces: Workspace[];
  /**
   * Props to be passed to individual slots.
   */
  slotProps?: {
    root?: BoxProps;
    header?: BoxProps;
    search?: PropsWithoutRef<InputProps>;
    button?: PropsWithoutRef<ButtonProps>;
  };
}

function checkStatusOfTheApplication(stateHistory: ApplicationState[] | []) {
  if (stateHistory.length === 0) {
    return ApplicationStatus.Empty;
  }

  if (stateHistory[0].stateId === undefined) {
    return ApplicationStatus.Empty;
  }

  return stateHistory[0].stateId;
}

export default function WorkspaceAndProjectList({
  workspaces,
  className,
  slotProps = {},
  ...props
}: WorkspaceAndProjectListProps) {
  const [query, setQuery] = useState('');
  const { maintenanceActive } = useUI();

  const handleQueryChange = debounce((event: ChangeEvent<HTMLInputElement>) => {
    slotProps?.search?.onChange?.(event);
    setQuery(event.target.value);
  }, 500);

  const filteredWorkspaces = workspaces
    .map((workspace) => ({
      ...workspace,
      projects: workspace.projects.filter((project) =>
        project.name.toLowerCase().includes(query.toLowerCase()),
      ),
    }))
    .filter((workspace) => workspace.projects.length > 0);

  return (
    <Box
      {...props}
      {...slotProps.root}
      className={twMerge(
        'grid grid-flow-row content-start gap-4',
        className,
        slotProps.root?.className,
      )}
    >
      <Box
        {...slotProps.header}
        className={twMerge(
          'grid grid-flow-col place-content-between items-center',
          slotProps.header?.className,
        )}
      >
        <Text variant="h2" component="h1" className="hidden md:block">
          My Projects
        </Text>

        <Input
          placeholder="Find Project"
          startAdornment={
            <SearchIcon
              className="ml-2 -mr-1 h-4 w-4 shrink-0"
              sx={{ color: 'text.disabled' }}
            />
          }
          {...slotProps.search}
          onChange={handleQueryChange}
        />

        <NavLink href="/new" passHref>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<PlusCircleIcon />}
            disabled={maintenanceActive}
            {...slotProps.button}
          >
            New Project
          </Button>
        </NavLink>
      </Box>

      <Box className="my-8 grid grid-flow-row gap-8">
        {filteredWorkspaces.map((workspace) => (
          <div key={workspace.slug}>
            <NavLink href={`/${workspace.slug}`} passHref>
              <Link
                href={`${workspace.slug}`}
                className="mb-1.5 block font-medium"
                underline="none"
                sx={{ color: 'text.primary' }}
              >
                {workspace.name}
              </Link>
            </NavLink>

            <List className="grid grid-flow-row border-y">
              {workspace.projects.map((project, index) => {
                const [latestDeployment] = project.deployments;

                return (
                  <Fragment key={project.slug}>
                    <ListItem.Root
                      secondaryAction={
                        <div className="grid grid-flow-col gap-px">
                          {latestDeployment && (
                            <div className="mr-2 flex self-center align-middle">
                              <StatusCircle
                                status={
                                  latestDeployment.deploymentStatus as DeploymentStatus
                                }
                              />
                            </div>
                          )}

                          <StateBadge
                            state={checkStatusOfTheApplication(
                              project.appStates,
                            )}
                            desiredState={project.desiredState}
                            title={getApplicationStatusString(
                              checkStatusOfTheApplication(project.appStates),
                            )}
                          />
                        </div>
                      }
                    >
                      <NavLink
                        href={`${workspace?.slug}/${project.slug}`}
                        passHref
                      >
                        <ListItem.Button className="rounded-none">
                          <ListItem.Avatar>
                            <div className="h-10 w-10 overflow-hidden rounded-lg">
                              <Image
                                src="/logos/new.svg"
                                alt="Nhost Logo"
                                width={40}
                                height={40}
                              />
                            </div>
                          </ListItem.Avatar>

                          <ListItem.Text
                            primary={project.name}
                            secondary={
                              <DeploymentStatusMessage
                                appCreatedAt={project.createdAt}
                                deployment={latestDeployment}
                              />
                            }
                          />
                        </ListItem.Button>
                      </NavLink>
                    </ListItem.Root>

                    {index < workspace.projects.length - 1 && (
                      <Divider component="li" role="listitem" />
                    )}
                  </Fragment>
                );
              })}
            </List>
          </div>
        ))}
      </Box>
    </Box>
  );
}
