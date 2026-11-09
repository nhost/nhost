import { SiHasura as HasuraIcon } from '@icons-pack/react-simple-icons';
import {
  Sparkles as AIIcon,
  DatabaseIcon,
  HardDrive as StorageIcon,
  UserIcon,
} from 'lucide-react';
import { ServicesOutlinedIcon } from '@/components/ui/v3/icons/ServicesOutlinedIcon';
import type { OverviewServiceKey } from '@/features/orgs/projects/overview/hooks/useOverviewServices';
import { cn } from '@/lib/utils';

const icons = {
  'hasura-auth': UserIcon,
  postgres: DatabaseIcon,
  'hasura-storage': StorageIcon,
  hasura: HasuraIcon,
  ai: AIIcon,
  run: ServicesOutlinedIcon,
} as const;

export interface ServiceIconProps {
  serviceKey: OverviewServiceKey;
  className?: string;
}

export default function ServiceIcon({
  serviceKey,
  className,
}: ServiceIconProps) {
  const Icon = icons[serviceKey];

  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}
