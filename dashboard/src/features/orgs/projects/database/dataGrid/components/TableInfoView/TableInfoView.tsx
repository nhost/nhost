import {
  ArrowRight,
  Check,
  Hash,
  Key,
  Link2,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/router';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Badge } from '@/components/ui/v3/badge';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { Spinner } from '@/components/ui/v3/spinner';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';
import type {
  TableConstraint,
  TableIndex,
  TableTrigger,
} from '@/features/orgs/projects/database/dataGrid/hooks/useTableRelatedObjectsQuery';
import { useTableRelatedObjectsQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableRelatedObjectsQuery';

export interface TableInfoViewProps {
  /**
   * Schema where the table is located.
   */
  schema?: string;
  /**
   * Table name.
   */
  table?: string;
  /**
   * Data source.
   */
  dataSource?: string;
}

function ConstraintIcon({ type }: { type: TableConstraint['type'] }) {
  switch (type) {
    case 'PRIMARY KEY':
      return <Key className="h-4 w-4 text-yellow-600" />;
    case 'FOREIGN KEY':
      return <Link2 className="h-4 w-4 text-blue-600" />;
    case 'UNIQUE':
      return <Hash className="h-4 w-4 text-purple-600" />;
    case 'CHECK':
      return <ShieldCheck className="h-4 w-4 text-green-600" />;
    default:
      return <Check className="h-4 w-4 text-muted-foreground" />;
  }
}

function ConstraintTypeBadge({ type }: { type: TableConstraint['type'] }) {
  const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
    'PRIMARY KEY': 'default',
    'FOREIGN KEY': 'secondary',
    UNIQUE: 'outline',
    CHECK: 'outline',
    EXCLUSION: 'outline',
  };

  return (
    <Badge variant={variants[type] || 'outline'} className="text-xs">
      {type}
    </Badge>
  );
}

function ConstraintCard({ constraint }: { constraint: TableConstraint }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <ConstraintIcon type={constraint.type} />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{constraint.name}</span>
            <ConstraintTypeBadge type={constraint.type} />
          </div>
          <div className="flex flex-wrap items-center gap-1 text-muted-foreground text-xs">
            <span>Columns:</span>
            {constraint.columns.map((col, idx) => (
              <span key={col}>
                <InlineCode className="px-1 text-xs">{col}</InlineCode>
                {idx < constraint.columns.length - 1 && ', '}
              </span>
            ))}
          </div>
          {constraint.type === 'CHECK' && (
            <div className="mt-2">
              <code className="block rounded bg-muted px-2 py-1 font-mono text-xs">
                {constraint.definition}
              </code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TriggerCard({ trigger }: { trigger: TableTrigger }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Zap
            className={`h-4 w-4 ${trigger.isEnabled ? 'text-yellow-500' : 'text-muted-foreground'}`}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{trigger.name}</span>
            {!trigger.isEnabled && (
              <Badge variant="outline" className="text-xs">
                Disabled
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
            <Badge variant="secondary" className="text-xs">
              {trigger.timing}
            </Badge>
            {trigger.events.map((event) => (
              <Badge key={event} variant="outline" className="text-xs">
                {event}
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <span>Function:</span>
            <ArrowRight className="h-3 w-3" />
            <InlineCode className="px-1 text-xs">
              {trigger.functionSchema}.{trigger.functionName}()
            </InlineCode>
          </div>
        </div>
      </div>
    </div>
  );
}

function IndexCard({ index }: { index: TableIndex }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Hash className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{index.name}</span>
            {index.isUnique && (
              <Badge variant="outline" className="text-xs">
                UNIQUE
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1 text-muted-foreground text-xs">
            <span>Columns:</span>
            {index.columns.map((col, idx) => (
              <span key={col}>
                <InlineCode className="px-1 text-xs">{col}</InlineCode>
                {idx < index.columns.length - 1 && ', '}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TableInfoView({
  schema: schemaProp,
  table: tableProp,
  dataSource: dataSourceProp,
}: TableInfoViewProps = {}) {
  const router = useRouter();
  const {
    query: { schemaSlug, tableSlug, dataSourceSlug },
  } = router;

  const schema = schemaProp || (schemaSlug as string);
  const table = tableProp || (tableSlug as string);
  const dataSource = dataSourceProp || (dataSourceSlug as string) || 'default';

  const currentPath =
    dataSource && schema && table ? `${dataSource}.${schema}.${table}` : '';

  const { data, status, error } = useTableRelatedObjectsQuery(
    ['table-related-objects', currentPath],
    {
      schema,
      table,
      dataSource,
      queryOptions: {
        enabled: !!currentPath && !!table,
      },
    },
  );

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner
          wrapperClassName="flex-row text-[12px] leading-[1.66] font-normal gap-1"
          className="h-4 w-4 justify-center"
        >
          Loading table information...
        </Spinner>
      </div>
    );
  }

  if (status === 'error' || data?.error) {
    return (
      <DataBrowserEmptyState
        title="Error loading table information"
        description={
          <span>
            {error instanceof Error
              ? error.message
              : data?.error ||
                'Unknown error occurred. Please try again later.'}
          </span>
        }
      />
    );
  }

  const constraints = data?.constraints ?? [];
  const triggers = data?.triggers ?? [];
  const indexes = data?.indexes ?? [];

  // Group constraints by type for better display
  const foreignKeys = constraints.filter((c) => c.type === 'FOREIGN KEY');
  const primaryKeys = constraints.filter((c) => c.type === 'PRIMARY KEY');
  const uniqueConstraints = constraints.filter((c) => c.type === 'UNIQUE');
  const checkConstraints = constraints.filter((c) => c.type === 'CHECK');
  const otherConstraints = constraints.filter((c) => c.type === 'EXCLUSION');

  const hasConstraints = constraints.length > 0;
  const hasTriggers = triggers.length > 0;
  const hasIndexes = indexes.length > 0;

  const defaultOpenItems = [
    hasConstraints && 'constraints',
    hasTriggers && 'triggers',
    hasIndexes && 'indexes',
  ].filter(Boolean) as string[];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-lg">Table Information</h2>
          <Badge variant="outline">
            {schema}.{table}
          </Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          View constraints, triggers, and indexes for this table.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!hasConstraints && !hasTriggers && !hasIndexes ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground">
                No constraints, triggers, or indexes found for this table.
              </p>
            </div>
          </div>
        ) : (
          <Accordion
            type="multiple"
            defaultValue={defaultOpenItems}
            className="space-y-3"
          >
            {/* Constraints Section */}
            {hasConstraints && (
              <AccordionItem value="constraints" className="rounded-lg border">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="font-medium">Constraints</span>
                    <Badge variant="secondary" className="ml-1">
                      {constraints.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    {/* Primary Keys */}
                    {primaryKeys.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          <Key className="h-3 w-3" />
                          Primary Key
                        </h4>
                        <div className="space-y-2">
                          {primaryKeys.map((c) => (
                            <ConstraintCard key={c.name} constraint={c} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Foreign Keys */}
                    {foreignKeys.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          <Link2 className="h-3 w-3" />
                          Foreign Keys
                        </h4>
                        <div className="space-y-2">
                          {foreignKeys.map((c) => (
                            <ConstraintCard key={c.name} constraint={c} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unique Constraints */}
                    {uniqueConstraints.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          <Hash className="h-3 w-3" />
                          Unique Constraints
                        </h4>
                        <div className="space-y-2">
                          {uniqueConstraints.map((c) => (
                            <ConstraintCard key={c.name} constraint={c} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Check Constraints */}
                    {checkConstraints.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          <ShieldCheck className="h-3 w-3" />
                          Check Constraints
                        </h4>
                        <div className="space-y-2">
                          {checkConstraints.map((c) => (
                            <ConstraintCard key={c.name} constraint={c} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Other Constraints */}
                    {otherConstraints.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          Other Constraints
                        </h4>
                        <div className="space-y-2">
                          {otherConstraints.map((c) => (
                            <ConstraintCard key={c.name} constraint={c} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Triggers Section */}
            {hasTriggers && (
              <AccordionItem value="triggers" className="rounded-lg border">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    <span className="font-medium">Triggers</span>
                    <Badge variant="secondary" className="ml-1">
                      {triggers.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-2">
                    {triggers.map((trigger) => (
                      <TriggerCard key={trigger.name} trigger={trigger} />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Indexes Section */}
            {hasIndexes && (
              <AccordionItem value="indexes" className="rounded-lg border">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    <span className="font-medium">Indexes</span>
                    <Badge variant="secondary" className="ml-1">
                      {indexes.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-2">
                    {indexes.map((index) => (
                      <IndexCard key={index.name} index={index} />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        )}
      </div>
    </div>
  );
}
