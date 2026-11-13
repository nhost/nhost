import { Globe } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { GetProjectsQuery } from '@/generated/graphql';

type Region = GetProjectsQuery['apps'][0]['region'];

function getRegionLabel({ name, city }: Region) {
  if (city && name) {
    return `${city} (${name})`;
  }

  return name || city || 'Unknown region';
}

interface ProjectRegionFlagProps {
  region: Region;
}

export default function ProjectRegionFlag({ region }: ProjectRegionFlagProps) {
  // Keyed on the code, so a refetch with another region shows its flag again.
  const [failedCode, setFailedCode] = useState<string | null>(null);

  const label = getRegionLabel(region);
  const { countryCode } = region;
  const showFlag = !!countryCode && countryCode !== failedCode;

  // A button, not a span: it sits above the card link (like the warning
  // icon), so hovering or focusing it shows the region without opening the
  // project.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Region: ${label}`}
          className="relative z-20 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          {showFlag ? (
            <Image
              src={`/assets/flags/${countryCode}.svg`}
              alt=""
              width={16}
              height={12}
              onError={() => setFailedCode(countryCode)}
            />
          ) : (
            <Globe aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
