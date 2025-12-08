// TODO: Implement
import { Button } from '@/components/ui/v3/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import type { SuggestRelationshipsResponseRelationshipsItem } from '@/utils/hasura-api/generated/schemas';
import { ArrowRight, Link2, Split } from 'lucide-react';
import { useState } from 'react';

interface SuggestedRelationshipsSectionProps {
  tableSchema: string;
  tableName: string;
  dataSource: string;
}

export default function SuggestedRelationshipsSection({
  tableSchema,
  tableName,
  dataSource,
}: SuggestedRelationshipsSectionProps) {
  const [selectedSuggestedRelationship, setSelectedSuggestedRelationship] =
    useState<SuggestRelationshipsResponseRelationshipsItem | null>(null);
  const [
    showAddSuggestedRelationshipDialog,
    setShowAddSuggestedRelationshipDialog,
  ] = useState(false);

  const normalizeColumns = (value: unknown): string[] => {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.map((column) => column.toString());
    }

    if (typeof value === 'object') {
      const foreignKeyObject = value as Record<string, unknown>;

      if ('columns' in foreignKeyObject && foreignKeyObject.columns) {
        return normalizeColumns(foreignKeyObject.columns);
      }

      if ('column' in foreignKeyObject && foreignKeyObject.column) {
        return [String(foreignKeyObject.column)];
      }
    }

    if (typeof value === 'string') {
      return [value];
    }

    return [];
  };

  const formatEndpoint = (
    schemaName: string | undefined,
    name: string | undefined,
    columns: string[],
  ) => {
    const qualifiedTable = `${schemaName ?? 'public'}.${
      name ?? 'unknown_table'
    }`;
    const formattedColumns =
      columns.length > 0 ? columns.join(', ') : 'Not specified';

    return `${qualifiedTable} / ${formattedColumns}`;
  };

  const suggestedRelationships = (tableSuggestions ?? [])
    .map((suggestion) => {
      const typeLabel =
        suggestion.type && suggestion.type.toLowerCase() === 'array'
          ? 'Array'
          : 'Object';

      const fromElement = suggestion.from;
      const toElement = suggestion.to;

      const localColumns = normalizeColumns(fromElement?.columns);
      const remoteColumns = normalizeColumns(toElement?.columns);

      const name =
        toElement?.constraint_name ??
        fromElement?.constraint_name ??
        toElement?.table?.name ??
        `${typeLabel.toLowerCase()}_relationship`;

      const key = [
        'suggested',
        typeLabel,
        fromElement?.table?.schema,
        fromElement?.table?.name,
        ...localColumns,
        toElement?.table?.schema,
        toElement?.table?.name,
        ...remoteColumns,
      ]
        .filter(Boolean)
        .join('-');

      const structuralKey = JSON.stringify({
        type: typeLabel,
        from: {
          schema: fromElement?.table?.schema ?? tableSchema,
          table: fromElement?.table?.name ?? tableName,
          columns: localColumns,
        },
        to: {
          schema: toElement?.table?.schema ?? tableSchema,
          table: toElement?.table?.name ?? tableName,
          columns: remoteColumns,
        },
      });

      if (existingRelationshipKeys.has(structuralKey)) {
        return null;
      }

      return {
        key: key || name,
        structuralKey,
        name,
        source: dataSource,
        type: typeLabel,
        from: formatEndpoint(
          fromElement?.table?.schema,
          fromElement?.table?.name,
          localColumns,
        ),
        to: formatEndpoint(
          toElement?.table?.schema,
          toElement?.table?.name,
          remoteColumns,
        ),
        rawSuggestion: suggestion,
      };
    })
    .filter(Boolean) as Array<{
    key: string;
    structuralKey: string;
    name: string;
    source: string;
    type: string;
    from: string;
    to: string;
    rawSuggestion: SuggestRelationshipsResponseRelationshipsItem;
  }>;

  return (
    <section className="px-6">
      <h2 className="text-sm+ font-semibold text-foreground">
        Suggested Relationships
      </h2>

      <p className="mt-1 text-sm text-muted-foreground">
        Review suggested relationships for {tableSchema}.{tableName}.
      </p>

      <div className="mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Name</TableHead>
              <TableHead className="w-[120px]">Source</TableHead>
              <TableHead className="w-[120px]">Type</TableHead>
              <TableHead>Relationship</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suggestedRelationships.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No suggested relationships available.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              suggestedRelationships.map((suggestion) => (
                <TableRow key={suggestion.key}>
                  <TableCell className="font-medium">
                    {suggestion.name}
                  </TableCell>
                  <TableCell>{suggestion.source}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {suggestion.type === 'Array' ? (
                        <Split className="h-4 w-4 rotate-90 text-muted-foreground" />
                      ) : (
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>{suggestion.type}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>{suggestion.from}</span>
                      <ArrowRight className="h-4 w-4" />
                      <span>{suggestion.to}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedSuggestedRelationship(
                          suggestion.rawSuggestion,
                        );
                        setShowAddSuggestedRelationshipDialog(true);
                      }}
                    >
                      Add
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
