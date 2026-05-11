import { Info } from 'lucide-react';
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
import { Switch } from '@/components/ui/v3/switch';
import type { DatabaseAction } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import PermissionDot from './PermissionDot';
import { ADMIN_ROLE } from './permissionState';

export interface SchemaDiagramToolbarProps {
  roles: string[];
  selectedRole: string;
  onRoleChange: (role: string) => void;
  schemas: string[];
  selectedSchemas: string[];
  onSelectedSchemasChange: (schemas: string[]) => void;
  hideEmpty: boolean;
  onHideEmptyChange: (value: boolean) => void;
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
}: SchemaDiagramToolbarProps) {
  const allRoles = roles.includes(ADMIN_ROLE) ? roles : [ADMIN_ROLE, ...roles];

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

      <div className="flex items-center gap-2">
        <Switch
          id="schema-diagram-hide-empty"
          checked={hideEmpty}
          onCheckedChange={onHideEmptyChange}
        />
        <label
          htmlFor="schema-diagram-hide-empty"
          className="cursor-pointer text-xs"
        >
          Hide tables without permissions
        </label>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2">
          {legendItems.map(({ action, label }) => (
            <div key={action} className="flex items-center gap-1">
              <PermissionDot action={action} state="filled" size={9} />
              <span className="text-muted-foreground text-xs">{label}</span>
            </div>
          ))}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Diagram legend"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent"
            >
              <Info className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[280px] text-xs">
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
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
