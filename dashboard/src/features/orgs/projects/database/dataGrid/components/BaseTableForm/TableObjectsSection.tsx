import { ExternalLink, KeyRound, Link2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Text } from '@/components/ui/v2/Text';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Badge } from '@/components/ui/v3/badge';
import { useTableRelatedObjectsQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableRelatedObjectsQuery';
import type {
  TableConstraint,
  TableIndex,
  TableTrigger,
} from '@/features/orgs/projects/database/dataGrid/hooks/useTableRelatedObjectsQuery/fetchTableRelatedObjects';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export interface TableObjectsSectionProps {
  /**
   * Schema where the table is located.
   */
  schema: string;
  /**
   * Table name.
   */
  table: string;
}

function ConstraintIcon({ type }: { type: TableConstraint['type'] }) {
  switch (type) {
    case 'PRIMARY KEY':
      return <KeyRound className="h-4 w-4 text-yellow-600" />;
    case 'FOREIGN KEY':
      return <Link2 className="h-4 w-4 text-blue-600" />;
    case 'CHECK':
      return <ShieldCheck className="h-4 w-4 text-green-600" />;
    default:
      return null;
  }
}

function ConstraintTypeBadge({ type }: { type: TableConstraint['type'] }) {
  const colorMap: Record<TableConstraint['type'], string> = {
    'PRIMARY KEY':
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    'FOREIGN KEY':
      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    UNIQUE:
      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    CHECK: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    EXCLUSION:
      'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  };

  return (
    <Badge variant="outline" className={colorMap[type]}>
      {type}
    </Badge>
  );
}

function ConstraintsList({ constraints }: { constraints: TableConstraint[] }) {
  const checkConstraints = constraints.filter((c) => c.type === 'CHECK');
  const otherConstraints = constraints.filter((c) => c.type !== 'CHECK');

  return (
    <div className="space-y-3">
      {otherConstraints.map((constraint) => (
        <div
          key={constraint.name}
          className="flex items-start gap-3 rounded-md border border-input bg-background p-3"
        >
          <ConstraintIcon type={constraint.type} />
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <Text className="font-medium text-sm+">{constraint.name}</Text>
              <ConstraintTypeBadge type={constraint.type} />
            </div>
            <Text className="font-mono text-muted-foreground text-sm">
              {constraint.definition}
            </Text>
            {constraint.columns.length > 0 && (
              <Text className="text-muted-foreground text-sm">
                Columns: {constraint.columns.join(', ')}
              </Text>
            )}
          </div>
        </div>
      ))}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Text className="font-medium text-muted-foreground text-sm uppercase">
            Check Constraints
          </Text>
        </div>

        {checkConstraints.length === 0 ? (
          <Text className="text-muted-foreground text-sm+">
            No check constraints defined.
          </Text>
        ) : (
          checkConstraints.map((constraint) => (
            <div
              key={constraint.name}
              className="flex items-start gap-3 rounded-md border border-input bg-background p-3"
            >
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Text className="font-medium text-sm+">
                    {constraint.name}
                  </Text>
                  <ConstraintTypeBadge type="CHECK" />
                </div>
                <Text className="font-mono text-muted-foreground text-sm">
                  {constraint.definition}
                </Text>
              </div>
            </div>
          ))
        )}

        {/* TODO: re-enable when check constraint creation is ready
        <Button
          variant="borderless"
          startIcon={<PlusIcon />}
          size="small"
          className="mt-1 justify-self-start rounded-sm+ py-2"
          onClick={handleAddCheckConstraint}
        >
          Add Check Constraint
        </Button>
        */}
      </div>
    </div>
  );
}

function TriggersList({ triggers }: { triggers: TableTrigger[] }) {
  const router = useRouter();
  const { orgSlug, appSubdomain, dataSourceSlug } = router.query;

  if (triggers.length === 0) {
    return (
      <Text className="text-muted-foreground text-sm+">
        No triggers defined on this table.
      </Text>
    );
  }

  return (
    <div className="space-y-3">
      {triggers.map((trigger) => {
        const functionUrl = `/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/${dataSourceSlug}/${trigger.functionSchema}/functions/${trigger.functionName}`;

        return (
          <div
            key={trigger.name}
            className="flex items-start gap-3 rounded-md border border-input bg-background p-3"
          >
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Text className="font-medium text-sm+">{trigger.name}</Text>
                <Badge variant={trigger.isEnabled ? 'default' : 'secondary'}>
                  {trigger.isEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <Text className="text-muted-foreground text-sm">
                {trigger.timing} {trigger.events.join(' OR ')}
              </Text>
              <div className="flex items-center gap-1">
                <Text className="text-muted-foreground text-sm">Function:</Text>
                <Link
                  href={functionUrl}
                  className="inline-flex items-center gap-1 text-primary text-sm hover:underline"
                >
                  {trigger.functionSchema}.{trigger.functionName}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IndexesList({ indexes }: { indexes: TableIndex[] }) {
  if (indexes.length === 0) {
    return (
      <Text className="text-muted-foreground text-sm+">
        No additional indexes on this table.
      </Text>
    );
  }

  return (
    <div className="space-y-3">
      {indexes.map((index) => (
        <div
          key={index.name}
          className="flex items-start gap-3 rounded-md border border-input bg-background p-3"
        >
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <Text className="font-medium text-sm+">{index.name}</Text>
              {index.isUnique && <Badge variant="secondary">Unique</Badge>}
            </div>
            <Text className="font-mono text-muted-foreground text-sm">
              {index.definition}
            </Text>
            {index.columns.length > 0 && (
              <Text className="text-muted-foreground text-sm">
                Columns: {index.columns.join(', ')}
              </Text>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TableObjectsSection({
  schema,
  table,
}: TableObjectsSectionProps) {
  const { project } = useProject();
  const isGitHubConnected = !!project?.githubRepository;

  const { data, status } = useTableRelatedObjectsQuery(
    ['tableRelatedObjects', schema, table],
    { schema, table },
  );

  if (status === 'loading') {
    return (
      <section className="px-6 py-3">
        <ActivityIndicator label="Loading table objects..." delay={500} />
      </section>
    );
  }

  if (status === 'error' || data?.error) {
    return (
      <section className="px-6 py-3">
        <Text className="text-destructive text-sm+">
          Failed to load table objects: {data?.error || 'Unknown error'}
        </Text>
      </section>
    );
  }

  const { constraints = [], triggers = [], indexes = [] } = data || {};

  return (
    <section className="border-t-1 px-6 py-3">
      <Accordion
        type="multiple"
        defaultValue={['constraints', 'indexes', 'triggers']}
        className="w-full"
      >
        <AccordionItem value="constraints">
          <AccordionTrigger className="py-2 text-lg">
            <div className="flex items-center gap-2">
              <span>Constraints</span>
              <Badge variant="secondary" className="text-sm">
                {constraints.length}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            {isGitHubConnected ? (
              <Text className="text-muted-foreground text-sm+">
                Constraints are managed via Git. View them in your repository.
              </Text>
            ) : (
              <ConstraintsList constraints={constraints} />
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="indexes">
          <AccordionTrigger className="py-2 text-lg">
            <div className="flex items-center gap-2">
              <span>Indexes</span>
              <Badge variant="secondary" className="text-sm">
                {indexes.length}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <IndexesList indexes={indexes} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="triggers">
          <AccordionTrigger className="py-2 text-lg">
            <div className="flex items-center gap-2">
              <span>Triggers</span>
              <Badge variant="secondary" className="text-sm">
                {triggers.length}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <TriggersList triggers={triggers} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
