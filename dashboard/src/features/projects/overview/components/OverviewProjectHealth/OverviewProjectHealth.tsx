import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { HasuraIcon } from '@/components/ui/v2/icons/HasuraIcon';
import { ProjectHealthCard } from '@/features/projects/overview/components/ProjectHealthCard';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import { DatabaseIcon } from '@/components/ui/v2/icons/DatabaseIcon';
import { StorageIcon } from '@/components/ui/v2/icons/StorageIcon';
import { AIIcon } from '@/components/ui/v2/icons/AIIcon';
import { Box } from '@/components/ui/v2/Box';
import { ServicesIcon } from '@/components/ui/v2/icons/ServicesIcon';

export default function OverviewProjectHealth() {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const RunList = [...Array(10).keys()].map((i) =>
  (<li className="flex flex-row items-center gap-4 text-ellipsis text-nowrap leading-5">
    <Box sx={{ backgroundColor: "success.dark" }} className="flex-shrink-0 w-3 h-3 bg-success rounded-full" />
    {`nhost-run-x-y-${i + 1}`}
  </li>)
  );
  const servicesTooltipElem = (<ol className="flex flex-col gap-3 px-4 py-6 m-0">{RunList}</ol>);


  return (
    <div className="grid grid-flow-row content-start gap-6">
      <Text variant="h3">Project Health</Text>

      {currentProject && (
        <div className="grid grid-flow-row items-center gap-6 xs:grid-cols-3 lg:gap-3 xl:grid-cols-6">
          <ProjectHealthCard icon={<UserIcon className="h-6 w-6" />}
            tooltip={servicesTooltipElem} />
          <ProjectHealthCard icon={<DatabaseIcon className="h-6 w-6" />}
            tooltip={servicesTooltipElem} />
          <ProjectHealthCard icon={<StorageIcon className="h-6 w-6" />}
            tooltip={servicesTooltipElem} />
          <ProjectHealthCard icon={<HasuraIcon className="h-6 w-6" />}
            tooltip={servicesTooltipElem} />
          <ProjectHealthCard icon={<ServicesIcon className="h-6 w-6" />}
            tooltip={servicesTooltipElem} />
          <ProjectHealthCard icon={<AIIcon className="h-6 w-6" />}
            tooltip={servicesTooltipElem} />
        </div>
      )}
    </div>
  );
}

