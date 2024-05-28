import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { InfoCard } from '@/features/projects/overview/components/InfoCard';
import { HasuraIcon } from '@/components/ui/v2/icons/HasuraIcon';
import Image from 'next/image';
import { ProjectHealthCard } from '@/features/projects/overview/components/ProjectHealthCard';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import { DatabaseIcon } from '@/components/ui/v2/icons/DatabaseIcon';
import { StorageIcon } from '@/components/ui/v2/icons/StorageIcon';
import { DockerIcon } from '@/components/ui/v2/icons/DockerIcon';
import { AIIcon } from '@/components/ui/v2/icons/AIIcon';

export default function OverviewProjectHealth() {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const { region, subdomain } = currentProject || {};
  const isRegionAvailable =
    region?.awsName && region?.countryCode && region?.city;

  return (
    <div className="grid grid-flow-row content-start gap-6">
      <Text variant="h3">Project Health</Text>

      {currentProject && (
          <div className="grid grid-flow-row items-center gap-6 xs:grid-cols-3 lg:gap-3 xl:grid-cols-6">
          <ProjectHealthCard icon={<UserIcon className="h-6 w-6" />} value="Hola" tooltip="Hola hola hola" />
          <ProjectHealthCard icon={<DatabaseIcon className="h-6 w-6" />} value="Hola" tooltip="Hola hola hola" />
          <ProjectHealthCard icon={<StorageIcon className="h-6 w-6" />} value="Hola" tooltip="Hola hola hola" />
          <ProjectHealthCard icon={<HasuraIcon className="h-6 w-6" />} value="Hola" tooltip="Hola hola hola" />
          <ProjectHealthCard icon={<DockerIcon className="h-6 w-6" />} value="Hola" tooltip="Hola hola hola" />
          <ProjectHealthCard icon={<AIIcon className="h-6 w-6" />} value="Hola" tooltip="Hola hola hola" />
          </div>
      )}
    </div>
  );
}

