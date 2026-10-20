import type { GraphQLSchema } from 'graphql';
import { cn } from '@/lib/utils';
import getSchemaNodeDetails from './getSchemaNodeDetails';
import type { SchemaTreeNode } from './types';

export interface SchemaNodeDetailsProps {
  schema: GraphQLSchema;
  node?: SchemaTreeNode;
  className?: string;
}

function Description({ text }: { text?: string | null }) {
  if (!text) {
    return <p className="text-muted-foreground italic">No description</p>;
  }

  return <p className="whitespace-pre-line">{text}</p>;
}

export default function SchemaNodeDetails({
  schema,
  node,
  className,
}: SchemaNodeDetailsProps) {
  if (!node || node.kind === 'root') {
    return (
      <aside className={cn('text-muted-foreground text-sm', className)}>
        Select an item to see its details.
      </aside>
    );
  }

  const details = getSchemaNodeDetails(schema, node);

  return (
    <aside
      aria-label="Details"
      className={cn('flex min-w-0 flex-col gap-4 text-sm', className)}
    >
      <div className="flex flex-col gap-1">
        <h3 className="break-all font-medium text-base">{node.name}</h3>
        <span className="text-muted-foreground text-xs">
          {details.kindLabel}
          {node.ownerType && ` on ${node.ownerType}`}
        </span>
      </div>

      {(node.typeLabel || node.kind === 'operation') && (
        <code className="break-all rounded bg-muted px-2 py-1 font-mono text-xs">
          {node.typeLabel ?? node.typeName}
          {node.defaultValue !== undefined && ` = ${node.defaultValue}`}
        </code>
      )}

      {node.deprecationReason != null && (
        <p className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs">
          Deprecated: {node.deprecationReason}
        </p>
      )}

      <Description text={node.description} />

      {details.arguments.length > 0 && (
        <section className="flex flex-col gap-2">
          <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Arguments
          </h4>
          <ul className="flex flex-col gap-3">
            {details.arguments.map((argument) => (
              <li key={argument.name} className="flex flex-col gap-0.5">
                <code className="break-all font-mono text-xs">
                  {argument.name}: {argument.typeLabel}
                  {argument.defaultValue !== undefined &&
                    ` = ${argument.defaultValue}`}
                </code>
                {argument.description && (
                  <span className="text-muted-foreground text-xs">
                    {argument.description}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {node.typeName && details.typeDescription && (
        <section className="flex flex-col gap-1">
          <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Type {node.typeName}
          </h4>
          <p className="text-muted-foreground">{details.typeDescription}</p>
        </section>
      )}
    </aside>
  );
}
