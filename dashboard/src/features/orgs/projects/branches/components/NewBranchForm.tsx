import { SiGithub } from '@icons-pack/react-simple-icons';
import { CheckCircle2, Info, Pencil } from 'lucide-react';
import { useRouter } from 'next/router';
import { type ReactNode, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/v3/input-group';
import { Label } from '@/components/ui/v3/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { BranchIcon } from '@/features/orgs/projects/branches/components/BranchBits';
import {
  type BranchSource,
  DUMMY_GIT_BRANCHES,
  toBranchSlug,
  useDummyBranches,
} from '@/features/orgs/projects/branches/dummy/useDummyBranches';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { cn } from '@/lib/utils';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';
import { triggerToast } from '@/utils/toast';

function MethodCard({
  selected,
  icon,
  title,
  description,
  onSelect,
}: {
  selected: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: card style radio
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'relative grid gap-1 rounded-lg border p-4 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'border-primary bg-primary/5',
      )}
    >
      {selected && (
        <CheckCircle2 className="absolute top-3 right-3 size-4 text-primary" />
      )}
      <span className={cn('mb-2', selected && 'text-primary')}>{icon}</span>
      <span className="font-medium text-sm">{title}</span>
      <span className="text-muted-foreground text-sm">{description}</span>
    </button>
  );
}

export default function NewBranchForm() {
  const router = useRouter();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);
  const { project } = useProject();
  const { branches, projectName, createBranch } = useDummyBranches();

  const [method, setMethod] = useState<BranchSource>('manual');
  const [name, setName] = useState('');
  const [gitBranch, setGitBranch] = useState('');
  const [autoRequest, setAutoRequest] = useState(true);

  // DUMMY: pretend every project has a repository connected.
  const repository =
    project?.githubRepository?.fullName ?? `nhost/${appSubdomain}`;

  const finalName = method === 'manual' ? name : toBranchSlug(gitBranch);
  const taken = branches.some((b) => b.name === finalName);
  const mirrored = new Set(branches.map((b) => b.gitBranch).filter(Boolean));
  const canCreate = finalName.length > 1 && !taken;

  function submit() {
    createBranch({
      name: finalName,
      source: method,
      gitBranch: method === 'github' ? gitBranch : undefined,
      openRequestsFromGitHub: autoRequest,
    });
    triggerToast(`Creating ${finalName}…`);
    router.push(`/orgs/${orgSlug}/projects/${appSubdomain}/branches?tab=all`);
  }

  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (canCreate) {
          submit();
        }
      }}
    >
      <fieldset className="grid gap-3">
        <legend className="mb-3 font-medium">
          How do you want to create it?
        </legend>
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
          <MethodCard
            selected={method === 'manual'}
            icon={<Pencil className="size-5" />}
            title="Manual"
            description="Name a branch and copy production right now."
            onSelect={() => setMethod('manual')}
          />
          <MethodCard
            selected={method === 'github'}
            icon={<SiGithub className="size-5" />}
            title="From GitHub"
            description="Mirror a Git branch, so every push deploys to it."
            onSelect={() => setMethod('github')}
          />
        </div>
      </fieldset>

      {method === 'manual' ? (
        <div className="grid gap-2">
          <Label htmlFor="branch-name">Branch name</Label>
          <InputGroup>
            <InputGroupAddon className="max-w-[50%] cursor-default">
              <span className="truncate">{projectName}</span>
              <span className="text-muted-foreground/60">/</span>
            </InputGroupAddon>
            <InputGroupInput
              id="branch-name"
              autoFocus
              placeholder="feature-checkout"
              className="font-mono"
              aria-invalid={taken}
              value={name}
              onChange={(e) => setName(toBranchSlug(e.target.value))}
            />
          </InputGroup>
          <p
            className={cn(
              'text-xs',
              taken ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {taken
              ? 'A branch with this name already exists in this project.'
              : 'Lowercase letters, numbers and hyphens. Spaces turn into hyphens as you type.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm">
            <SiGithub className="size-4 shrink-0" />
            <span className="truncate font-mono">{repository}</span>
            <span className="ml-1 inline-flex shrink-0 items-center rounded-full border border-emerald-500/40 px-2 py-px font-medium text-emerald-600 text-xs dark:text-emerald-400">
              Connected
            </span>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="git-branch">Git branch</Label>
            <Select value={gitBranch} onValueChange={setGitBranch}>
              <SelectTrigger id="git-branch" className="font-mono">
                <SelectValue placeholder="Pick a branch from GitHub" />
              </SelectTrigger>
              <SelectContent>
                {DUMMY_GIT_BRANCHES.map((git) => (
                  <SelectItem
                    key={git}
                    value={git}
                    disabled={mirrored.has(git)}
                    className="font-mono"
                  >
                    {git}
                    {mirrored.has(git) && (
                      <span className="ml-2 font-sans text-muted-foreground text-xs">
                        already mirrored
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {gitBranch && (
              <p className="text-muted-foreground text-xs">
                Creates <span className="font-mono">{finalName}</span>. Every
                push to <span className="font-mono">{gitBranch}</span> deploys
                to it.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="auto-request"
              checked={autoRequest}
              onCheckedChange={(v) => setAutoRequest(v === true)}
            />
            <Label htmlFor="auto-request" className="font-normal">
              Open a merge request when a pull request is opened on GitHub
            </Label>
          </div>
        </div>
      )}

      <div className="grid gap-2">
        <span className="font-medium text-sm">Copied from</span>
        <div className="flex items-center gap-2 text-sm">
          <BranchIcon branch={{ isProduction: true }} />
          <span className="font-mono">production</span>
        </div>
      </div>

      <Alert variant="info" className="py-3">
        <Info className="size-4" />
        <AlertDescription>
          Only the structure is copied, not the data. The new branch starts
          empty, so no real user data leaves production.
        </AlertDescription>
      </Alert>

      <div className="flex justify-end">
        <Button type="submit" disabled={!canCreate}>
          Create branch
        </Button>
      </div>
    </form>
  );
}
