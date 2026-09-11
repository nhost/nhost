import { ShieldCheck, User } from 'lucide-react';
import type { ComponentType } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/v3/toggle-group';
import { Organization_Members_Role_Enum } from '@/generated/graphql';
import { cn } from '@/lib/utils';

const ROLE_OPTIONS: {
  value: Organization_Members_Role_Enum;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  {
    value: Organization_Members_Role_Enum.User,
    label: 'User',
    description: 'Can view and collaborate on projects',
    icon: User,
  },
  {
    value: Organization_Members_Role_Enum.Admin,
    label: 'Admin',
    description: 'Full access to manage the organization',
    icon: ShieldCheck,
  },
];

export interface RoleSelectorProps {
  value?: Organization_Members_Role_Enum;
  onChange: (value: Organization_Members_Role_Enum) => void;
  disabled?: boolean;
  className?: string;
}

export default function RoleSelector({
  value,
  onChange,
  disabled,
  className,
}: RoleSelectorProps) {
  return (
    <ToggleGroup
      type="single"
      aria-label="Role"
      value={value}
      onValueChange={(next) => {
        if (next) {
          onChange(next as Organization_Members_Role_Enum);
        }
      }}
      disabled={disabled}
      className={cn('w-full items-stretch gap-3', className)}
    >
      {ROLE_OPTIONS.map(({ value: roleValue, label, description, icon: Icon }) => (
        <ToggleGroupItem
          key={roleValue}
          value={roleValue}
          aria-label={label}
          className="group h-auto flex-1 flex-col items-start justify-start gap-1.5 whitespace-normal rounded-lg border border-input bg-background px-4 py-3 text-left transition-colors data-[state=off]:hover:border-muted-foreground/50 data-[state=off]:hover:bg-muted/40 data-[state=on]:border-primary data-[state=on]:bg-background"
        >
          <div className="flex flex-row items-center gap-2.5 text-muted-foreground group-data-[state=on]:text-primary-main">
            <Icon className="!h-6 !w-6" />
            <span className="font-semibold text-base">{label}</span>
          </div>
          <p className="text-muted-foreground text-xs">{description}</p>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
