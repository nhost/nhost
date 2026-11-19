import { Copy, Ellipsis, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import type { GetProjectsQuery } from '@/generated/graphql';
import { copy } from '@/utils/copy';

type Project = GetProjectsQuery['apps'][0];

interface ProjectCardMenuProps {
  project: Project;
  orgSlug?: string;
}

// Sits above the card link (z-20), so opening it never opens the project.
// Subdomain and region are what the SDK client takes, hence the copy items.
export default function ProjectCardMenu({
  project,
  orgSlug,
}: ProjectCardMenuProps) {
  // Closed with the mouse: don't send focus back to the button, or its focus
  // ring stays on after a click. Keyboard users still get focus back.
  const closedWithPointer = useRef(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="subtle"
          size="icon-xs"
          aria-label={
            project.region.name
              ? `Actions for ${project.name} (${project.region.name})`
              : `Actions for ${project.name}`
          }
          className="relative z-20 ml-auto shrink-0 text-muted-foreground hover:text-foreground data-[state=open]:text-foreground"
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48"
        onPointerDown={() => {
          closedWithPointer.current = true;
        }}
        onKeyDown={() => {
          closedWithPointer.current = false;
        }}
        onPointerDownOutside={() => {
          closedWithPointer.current = true;
        }}
        onCloseAutoFocus={(event) => {
          if (closedWithPointer.current) {
            event.preventDefault();
          }
          closedWithPointer.current = false;
        }}
      >
        <DropdownMenuItem
          className="cursor-pointer gap-2"
          onSelect={() => copy(project.subdomain, 'Subdomain')}
        >
          <Copy className="h-4 w-4" />
          Copy subdomain
        </DropdownMenuItem>
        {project.region.name && (
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onSelect={() => copy(project.region.name, 'Region')}
          >
            <Copy className="h-4 w-4" />
            Copy region
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer gap-2">
          <Link
            href={`/orgs/${orgSlug}/projects/${project.subdomain}/settings`}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
