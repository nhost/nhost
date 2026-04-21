import { ExternalLink, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Badge } from '@/components/ui/v3/badge';
import { Spinner } from '@/components/ui/v3/spinner';
import { useTableRelatedObjectsQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableRelatedObjectsQuery';
import type {
  TableConstraint,
  TableIndex,
  TableTrigger,
} from '@/features/orgs/projects/database/dataGrid/hooks/useTableRelatedObjectsQuery/fetchTableRelatedObjects';

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

function CheckConstraintsList({
  constraints,
}: {
  constraints: TableConstraint[];
}) {
  if (constraints.length === 0) {
    return (
      <p className="text-muted-foreground text-sm+">
        No check constraints defined on this table.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {constraints.map((constraint) => (
        <div
          key={constraint.name}
          className="flex items-start gap-3 rounded-md border border-input bg-background p-3"
        >
          <ShieldCheck className="h-4 w-4 text-green-600" />
          <div className="flex-1 space-y-1">
            <p className="font-medium text-sm+">{constraint.name}</p>
            <p className="font-mono text-muted-foreground text-sm">
              {constraint.definition}
            </p>
            {constraint.columns.length > 0 && (
              <p className="text-muted-foreground text-sm">
                Columns: {constraint.columns.join(', ')}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TriggersList({ triggers }: { triggers: TableTrigger[] }) {
  const router = useRouter();
  const { orgSlug, appSubdomain, dataSourceSlug } = router.query;

  if (triggers.length === 0) {
    return (
      <p className="text-muted-foreground text-sm+">
        No triggers defined on this table.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {triggers.map((trigger) => {
        const functionUrl = `/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/${dataSourceSlug}/${trigger.functionSchema}/functions/${trigger.functionOid}`;

        return (
          <div
            key={trigger.name}
            className="flex items-start gap-3 rounded-md border border-input bg-background p-3"
          >
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm+">{trigger.name}</p>
                <Badge variant={trigger.isEnabled ? 'default' : 'secondary'}>
                  {trigger.isEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                {trigger.timing} {trigger.events.join(' OR ')}
              </p>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-sm">Function:</span>
                <Link
                  href={functionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
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
      <p className="text-muted-foreground text-sm+">
        No additional indexes on this table.
      </p>
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
              <p className="font-medium text-sm+">{index.name}</p>
              {index.isUnique && <Badge variant="secondary">Unique</Badge>}
            </div>
            <p className="font-mono text-muted-foreground text-sm">
              {index.definition}
            </p>
            {index.columns.length > 0 && (
              <p className="text-muted-foreground text-sm">
                Columns: {index.columns.join(', ')}
              </p>
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
  const { data, status } = useTableRelatedObjectsQuery(
    ['tableRelatedObjects', schema, table],
    { schema, table },
  );

  if (status === 'loading') {
    return (
      <AccordionItem value="_loading" disabled className="border-b-0">
        <div className="px-6 py-3">
          <Spinner className="h-4 w-4" wrapperClassName="flex-row gap-1">
            Loading table objects...
          </Spinner>
        </div>
      </AccordionItem>
    );
  }

  if (status === 'error' || data?.error) {
    return (
      <AccordionItem value="_error" disabled className="border-b-0">
        <div className="px-6 py-3">
          <p className="text-destructive text-sm+">
            Failed to load table objects: {data?.error || 'Unknown error'}
          </p>
        </div>
      </AccordionItem>
    );
  }

  const { constraints = [], triggers = [], indexes = [] } = data || {};
  const checkConstraints = constraints.filter((c) => c.type === 'CHECK');

  return (
    <>
      {checkConstraints.length > 0 && (
        <AccordionItem value="constraints">
          <AccordionTrigger className="px-6 py-2 text-lg">
            Check Constraints ({checkConstraints.length})
          </AccordionTrigger>
          <AccordionContent className="px-6 pt-2 pb-4">
            <CheckConstraintsList constraints={checkConstraints} />
          </AccordionContent>
        </AccordionItem>
      )}

      {indexes.length > 0 && (
        <AccordionItem value="indexes">
          <AccordionTrigger className="px-6 py-2 text-lg">
            Indexes ({indexes.length})
          </AccordionTrigger>
          <AccordionContent className="px-6 pt-2 pb-4">
            <IndexesList indexes={indexes} />
          </AccordionContent>
        </AccordionItem>
      )}

      {triggers.length > 0 && (
        <AccordionItem value="triggers">
          <AccordionTrigger className="px-6 py-2 text-lg">
            Triggers ({triggers.length})
          </AccordionTrigger>
          <AccordionContent className="px-6 pt-2 pb-4">
            <TriggersList triggers={triggers} />
          </AccordionContent>
        </AccordionItem>
      )}
    </>
  );
}
