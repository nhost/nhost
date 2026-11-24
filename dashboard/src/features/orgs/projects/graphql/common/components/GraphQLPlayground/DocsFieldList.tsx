import {
  type DocExplorerFieldDef,
  TypeLink,
  useDocExplorerActions,
} from '@graphiql/plugin-doc-explorer';
import {
  type GraphQLInputObjectType,
  type GraphQLInterfaceType,
  type GraphQLObjectType,
  isInputObjectType,
} from 'graphql';
import { useState } from 'react';
import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';
import { Button } from '@/components/ui/v3/button';
import { buildFieldSnippet } from '@/features/orgs/projects/graphql/common/utils/buildDocsSnippet';
import { SectionTitle } from './SchemaTypeGroups';

interface FieldCardProps {
  field: DocExplorerFieldDef;
  /** A query snippet for the field, copied by the button in its corner. */
  snippet: string | null;
}

// One field as a small card: its name opens its docs, its type opens the type,
// and the copy button shows on hover, like code blocks in docs.
function FieldCard({ field, snippet }: FieldCardProps) {
  const { push } = useDocExplorerActions();

  return (
    <li className="group relative rounded-md border bg-background p-4 pr-12">
      <div className="font-mono text-sm">
        <button
          type="button"
          onClick={() => push({ name: field.name, def: field })}
          className="text-[oklch(var(--accent-blue))] hover:underline"
        >
          {field.name}
        </button>
        <span className="text-muted-foreground">: </span>
        <TypeLink type={field.type} />
      </div>

      {field.description && (
        <p className="mt-1 text-muted-foreground text-sm">
          {field.description}
        </p>
      )}

      {snippet && (
        <div className="absolute top-3.5 right-2.5 flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <CopyToClipboardButton
            textToCopy={snippet}
            title={field.name}
            className="h-7 w-7"
          />
        </div>
      )}
    </li>
  );
}

type FieldsType =
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLInputObjectType;

// Output fields get a snippet; input fields can't be selected in a query.
function getFieldCards(type: FieldsType): FieldCardProps[] {
  if (isInputObjectType(type)) {
    return Object.values(type.getFields()).map((field) => ({
      field,
      snippet: null,
    }));
  }

  return Object.values(type.getFields()).map((field) => ({
    field,
    snippet: buildFieldSnippet(field),
  }));
}

interface DocsFieldListProps {
  type: FieldsType;
}

/**
 * A type's fields, in place of GraphiQL's list, which has no room for a copy
 * button.
 */
export default function DocsFieldList({ type }: DocsFieldListProps) {
  const [showDeprecated, setShowDeprecated] = useState(false);
  const cards = getFieldCards(type);
  const fields = cards.filter(({ field }) => !field.deprecationReason);
  const deprecatedFields = cards.filter(({ field }) => field.deprecationReason);
  const shown =
    showDeprecated || fields.length === 0
      ? [...fields, ...deprecatedFields]
      : fields;

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle title="Fields" count={shown.length} />

      <ul className="flex flex-col gap-2">
        {shown.map(({ field, snippet }) => (
          <FieldCard key={field.name} field={field} snippet={snippet} />
        ))}
      </ul>

      {!showDeprecated && fields.length > 0 && deprecatedFields.length > 0 && (
        <Button
          variant="outline"
          size="xs"
          className="self-start"
          onClick={() => setShowDeprecated(true)}
        >
          Show deprecated fields
        </Button>
      )}
    </section>
  );
}
