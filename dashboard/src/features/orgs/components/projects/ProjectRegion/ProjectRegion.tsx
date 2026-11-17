import Image from 'next/image';
import { useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { GetProjectsQuery } from '@/generated/graphql';
import { cn } from '@/lib/utils';

type Region = GetProjectsQuery['apps'][0]['region'];

function getRegionLabel({ name, city }: Region) {
  if (city && name) {
    return `${city} (${name})`;
  }

  return name || city || 'Unknown region';
}

interface ProjectRegionProps {
  region: Region;
  className?: string;
}

export default function ProjectRegion({
  region,
  className,
}: ProjectRegionProps) {
  // Keyed on the code, so a refetch with another region shows its flag again.
  const [failedCode, setFailedCode] = useState<string | null>(null);

  const label = getRegionLabel(region);
  const { countryCode } = region;
  const showFlag = !!countryCode && countryCode !== failedCode;

  // The region code reads as plain text (it's what the SDK takes), so many
  // cards stay calm; the flag and city only show in the tooltip. A button, not a span: it sits above the card link
  // (like the warning icon), so hovering or focusing it shows the region
  // without opening the project.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Region: ${label}`}
          className={cn(
            'relative z-20 min-w-0 truncate rounded-sm bg-transparent p-0 text-muted-foreground text-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          {region.name || region.city || 'Unknown region'}
        </button>
      </TooltipTrigger>
      <TooltipContent className="flex items-center gap-2">
        {showFlag && (
          <Image
            src={`/assets/flags/${countryCode}.svg`}
            alt=""
            width={16}
            height={12}
            onError={() => setFailedCode(countryCode)}
          />
        )}
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
