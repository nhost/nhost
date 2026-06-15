import { Info, Plus, Search, SquareFunction, Table2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/v3/command';
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from '@/components/ui/v3/multi-select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import type { DatabaseAction } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import HideEmptyTablesSwitch from './HideEmptyTablesSwitch';
import NamingModeSwitch from './NamingModeSwitch';
import PermissionDot from './PermissionDot';
import { ADMIN_ROLE } from './permissionState';
import type { NamingMode } from './useSchemaGraph';

export interface SchemaDiagramSearchObject {
  schema: string;
  name: string;
  kind: 'table' | 'function';
  returnSchema?: string;
}

export interface SchemaDiagramToolbarProps {
  roles: string[];
  selectedRole: string;
  onRoleChange: (role: string) => void;
  schemas: string[];
  selectedSchemas: string[];
  onSelectedSchemasChange: (schemas: string[]) => void;
  hideEmpty: boolean;
  onHideEmptyChange: (value: boolean) => void;
  namingMode: NamingMode;
  onNamingModeChange: (mode: NamingMode) => void;
  onNewTable: () => void;
  canCreateTable: boolean;
  targetSchema: string;
  objects: SchemaDiagramSearchObject[];
  onSelectObject: (object: SchemaDiagramSearchObject) => void;
}

const legendItems: Array<{ action: DatabaseAction; label: string }> = [
  { action: 'select', label: 'Select' },
  { action: 'insert', label: 'Insert' },
  { action: 'update', label: 'Update' },
  { action: 'delete', label: 'Delete' },
];

export default function SchemaDiagramToolbar({
  roles,
  selectedRole,
  onRoleChange,
  schemas,
  selectedSchemas,
  onSelectedSchemasChange,
  hideEmpty,
  onHideEmptyChange,
  namingMode,
  onNamingModeChange,
  onNewTable,
  canCreateTable,
  targetSchema,
  objects,
  onSelectObject,
}: SchemaDiagramToolbarProps) {
  const allRoles = roles.includes(ADMIN_ROLE) ? roles : [ADMIN_ROLE, ...roles];
  const [searchOpen, setSearchOpen] = useState(false);
  const objectsBySchema = useMemo(() => {
    const grouped = new Map<string, SchemaDiagramSearchObject[]>();
    for (const object of objects) {
      const list = grouped.get(object.schema) ?? [];
      list.push(object);
      grouped.set(object.schema, list);
    }
    return Array.from(grouped.entries());
  }, [objects]);

  return (
    <div className="flex flex-wrap items-center gap-3 border-border border-b bg-background px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">Role</span>
        <Select value={selectedRole} onValueChange={onRoleChange}>
          <SelectTrigger className="h-8 w-[160px]">
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            {allRoles.map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">Schemas</span>
        <MultiSelect
          values={selectedSchemas}
          onValuesChange={onSelectedSchemasChange}
        >
          <MultiSelectTrigger className="h-8 max-w-[320px]">
            <MultiSelectValue placeholder="All schemas" />
          </MultiSelectTrigger>
          <MultiSelectContent>
            {schemas.map((schema) => (
              <MultiSelectItem key={schema} value={schema}>
                {schema}
              </MultiSelectItem>
            ))}
          </MultiSelectContent>
        </MultiSelect>
      </div>

      <HideEmptyTablesSwitch
        selectedRole={selectedRole}
        hideEmpty={hideEmpty}
        onHideEmptyChange={onHideEmptyChange}
      />

      <NamingModeSwitch
        namingMode={namingMode}
        onNamingModeChange={onNamingModeChange}
      />

      <div className="ml-auto flex items-center gap-3">
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Search database objects"
              className="flex h-8 w-[220px] items-center gap-1.5 rounded-md border border-border bg-background px-2 text-muted-foreground text-xs hover:bg-accent"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-left">Search database objects…</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[320px] p-0">
            <Command>
              <CommandInput placeholder="Search database objects…" />
              <CommandList>
                <CommandEmpty>No database objects found.</CommandEmpty>
                {objectsBySchema.map(([schema, items]) => (
                  <CommandGroup key={schema} heading={schema}>
                    {items.map((object) => {
                      const ObjectIcon =
                        object.kind === 'function' ? SquareFunction : Table2;
                      return (
                        <CommandItem
                          key={`${object.kind}:${object.schema}.${object.name}`}
                          value={`${object.kind}:${object.schema}.${object.name}`}
                          onSelect={() => {
                            onSelectObject(object);
                            setSearchOpen(false);
                          }}
                        >
                          <ObjectIcon
                            aria-hidden
                            className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          />
                          <span className="text-muted-foreground">
                            {object.schema}.
                          </span>
                          <span className="font-medium">{object.name}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs"
          onClick={onNewTable}
          disabled={!canCreateTable}
          title={
            canCreateTable
              ? `Create a new table in "${targetSchema}"`
              : 'No schema available'
          }
        >
          <Plus className="h-4 w-4" />
          New Table
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Diagram help"
              className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-muted-foreground text-xs hover:bg-accent"
            >
              <Info className="h-4 w-4" />
              <span>Help</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[320px] text-xs">
            <div className="space-y-3">
              <div>
                <div className="mb-1 font-semibold">Dot colors</div>
                <ul className="space-y-1">
                  {legendItems.map(({ action, label }) => (
                    <li key={action} className="flex items-center gap-2">
                      <PermissionDot action={action} state="filled" />
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="mb-1 font-semibold">Dot states</div>
                <ul className="space-y-1">
                  <li className="flex items-center gap-2">
                    <PermissionDot action="select" state="filled" />
                    <span>Allowed (no row filter)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <PermissionDot action="select" state="hollow" />
                    <span>Allowed with filter / check</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <PermissionDot action="select" state="none" />
                    <span>Not allowed</span>
                  </li>
                </ul>
              </div>
              <div>
                <div className="mb-1 font-semibold">Edge markers</div>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2">
                    <svg
                      width="56"
                      height="16"
                      viewBox="0 0 56 16"
                      aria-hidden="true"
                      className="shrink-0"
                    >
                      <line
                        x1="2"
                        y1="8"
                        x2="44"
                        y2="8"
                        stroke="rgb(148, 163, 184)"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M44,3 L54,8 L44,13 z"
                        fill="rgb(148, 163, 184)"
                      />
                    </svg>
                    <span>
                      <span className="text-foreground">Solid arrow</span> —
                      array relationship tracked (target side)
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg
                      width="56"
                      height="16"
                      viewBox="0 0 56 16"
                      aria-hidden="true"
                      className="shrink-0"
                    >
                      <line
                        x1="2"
                        y1="8"
                        x2="44"
                        y2="8"
                        stroke="rgb(148, 163, 184)"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M44,3 L54,8 L44,13 z"
                        fill="hsl(var(--background))"
                        stroke="rgb(148, 163, 184)"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>
                      <span className="text-foreground">Hollow arrow</span> —
                      array relationship missing
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg
                      width="56"
                      height="16"
                      viewBox="0 0 56 16"
                      aria-hidden="true"
                      className="shrink-0"
                    >
                      <circle
                        cx="6"
                        cy="8"
                        r="4"
                        fill="hsl(var(--background))"
                        stroke="rgb(148, 163, 184)"
                        strokeWidth="1.5"
                      />
                      <line
                        x1="11"
                        y1="8"
                        x2="44"
                        y2="8"
                        stroke="rgb(148, 163, 184)"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M44,3 L54,8 L44,13 z"
                        fill="rgb(148, 163, 184)"
                      />
                    </svg>
                    <span>
                      <span className="text-foreground">Hollow circle</span> —
                      object relationship missing (source side)
                    </span>
                  </li>
                </ul>
              </div>
              <div>
                <div className="mb-1 font-semibold">
                  Set-returning functions
                </div>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2">
                    <span className="flex w-14 shrink-0 justify-center">
                      <SquareFunction
                        aria-hidden="true"
                        className="h-4 w-4 text-muted-foreground"
                      />
                    </span>
                    <span>
                      <span className="text-foreground">Function node</span> — a
                      function that returns{' '}
                      <span className="font-mono">setof</span> a table
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg
                      width="56"
                      height="16"
                      viewBox="0 0 56 16"
                      aria-hidden="true"
                      className="shrink-0"
                    >
                      <line
                        x1="2"
                        y1="8"
                        x2="42"
                        y2="8"
                        stroke="rgb(148, 163, 184)"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M42,3 L47,8 L42,13 M47,3 L52,8 L47,13"
                        fill="none"
                        stroke="rgb(148, 163, 184)"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>
                      <span className="text-foreground">Double arrow</span> —
                      points to the table the function returns rows of
                    </span>
                  </li>
                </ul>
              </div>
              <div>
                <div className="mb-1 font-semibold">Interactions</div>
                <ul className="space-y-1 text-muted-foreground">
                  <li>
                    <span className="text-foreground">Click a table</span> to
                    focus it and its foreign-key relationships.
                  </li>
                  <li>
                    <span className="text-foreground">
                      Click a second table
                    </span>{' '}
                    to show only the connections between the two.
                  </li>
                  <li>
                    <span className="text-foreground">Click a connection</span>{' '}
                    to focus that specific relationship.
                  </li>
                  <li>
                    <span className="text-foreground">Click the canvas</span> to
                    clear the selection.
                  </li>
                </ul>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
