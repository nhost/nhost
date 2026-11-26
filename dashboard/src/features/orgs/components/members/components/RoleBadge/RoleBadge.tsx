import { Badge } from '@/components/ui/v3/badge';
import { roleOptions } from '@/features/orgs/components/members/components/RoleSelector';
import { Organization_Members_Role_Enum } from '@/generated/graphql';
import { cn } from '@/lib/utils';

export interface RoleBadgeProps {
  role: Organization_Members_Role_Enum;
}

export default function RoleBadge({ role }: RoleBadgeProps) {
  const option = roleOptions.find(({ value }) => value === role);
  const Icon = option?.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'h-5 gap-1 px-1.5 py-0 font-medium text-xs',
        role === Organization_Members_Role_Enum.Admin &&
          'border-primary text-primary',
      )}
    >
      {Icon && <Icon className="size-3" />}
      {option?.label ?? role}
    </Badge>
  );
}
