import { ShieldCheck, User } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/v3/toggle-group';
import { Organization_Members_Role_Enum } from '@/generated/graphql';

const roleOptions = [
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
}

export default function RoleSelector({ value, onChange }: RoleSelectorProps) {
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
      className="w-full items-stretch gap-3"
    >
      {roleOptions.map(
        ({ value: roleValue, label, description, icon: Icon }) => (
          <ToggleGroupItem
            key={roleValue}
            value={roleValue}
            aria-label={label}
            className="group h-auto flex-1 flex-col items-start justify-start gap-1.5 whitespace-normal rounded-lg border border-input bg-background px-4 py-3 text-left data-[state=on]:border-primary data-[state=on]:bg-background data-[state=off]:hover:border-muted-foreground/50 data-[state=off]:hover:bg-muted/40 [&_svg]:size-6"
          >
            <div className="flex flex-row items-center gap-2.5 text-muted-foreground group-data-[state=on]:text-primary">
              <Icon />
              <span className="font-semibold text-base">{label}</span>
            </div>
            <p className="text-muted-foreground text-xs">{description}</p>
          </ToggleGroupItem>
        ),
      )}
    </ToggleGroup>
  );
}
