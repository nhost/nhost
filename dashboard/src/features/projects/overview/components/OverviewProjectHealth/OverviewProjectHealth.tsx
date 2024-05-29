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
// import { useGetConfiguredVersionsQuery, useGetRecommendedVersionsQuery } from '@/generated/graphql';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';

export default function OverviewProjectHealth() {
  const isPlatform = useIsPlatform();
  const { currentProject } = useCurrentWorkspaceAndProject();
  // const { data: recommendedVersionsData, loading: loadingRecommendedVersions } = useGetRecommendedVersionsQuery({
  //   skip: !isPlatform
  // });

  // if (loadingRecommendedVersions) {
  //   return (
  //     <div className="grid grid-flow-row content-start gap-6">
  //       <Text variant="h3">Project Health</Text>
  //       <ActivityIndicator
  //         delay={1000}
  //         label="Loading Project Health..."
  //         className="justify-center"
  //       />
  //     </div>
  //   )
  // }

  const RunList = [...Array(10).keys()].map((i) =>
  (<li className="flex flex-row items-center gap-4 text-ellipsis text-nowrap leading-5">
    <Box sx={{ backgroundColor: "success.dark" }} className="flex-shrink-0 w-3 h-3 bg-success rounded-full" />
    {`nhost-run-x-y-${i + 1}`}
  </li>)
  );
  const servicesTooltipElem = (<ol className="flex flex-col gap-3 px-4 py-6 m-0">{RunList}</ol>);

  const outdatedAuthTooltipElem = (<div className="flex flex-col gap-3 px-2 py-3">
    <div className="flex flex-row justify-between gap-1">
      <Text variant="h4" component="p" className="text-white/70 font-bold" >service</Text>
      <Text variant="h4" component="p" className="text-white font-bold">Auth</Text>
    </div>
    <div className="flex flex-row justify-between gap-1">
      <Text variant="h4" component="p" className="text-white/70 font-bold" >version</Text>
      <Text variant="h4" component="p" className="text-white font-bold">0.28.0</Text>
    </div>
    <Box sx={{ backgroundColor: "grey.600" }} className="rounded-md p-2">
      <Text variant="body1" component="p" className="text-white">
        Auth is outdated, recommended versions: 0.30.0, 0.30.1
      </Text>
    </Box>
  </div>)

  return (
    <div className="grid grid-flow-row content-start gap-6">
      <Text variant="h3">Project Health</Text>

      {currentProject && (
        <div className="grid grid-flow-row items-center gap-6 xs:grid-cols-3 lg:gap-3 xl:grid-cols-6">
          <ProjectHealthCard icon={<UserIcon className="h-6 w-6" />}
            tooltip={outdatedAuthTooltipElem} />
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

