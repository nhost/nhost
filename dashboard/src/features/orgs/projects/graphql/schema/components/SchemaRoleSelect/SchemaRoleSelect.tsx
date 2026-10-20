import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { getAdminRoles } from '@/features/orgs/projects/roles/settings/utils/getAdminRoles';
import { useGetRemoteAppRolesQuery } from '@/generated/graphql';

export interface SchemaRoleSelectProps {
  value: string;
  onChange: (role: string) => void;
}

/**
 * Selects a role from the roles the Playground offers for the Admin user:
 * `admin`, `public`, `anonymous` and the roles in `auth.roles`.
 */
export default function SchemaRoleSelect({
  value,
  onChange,
}: SchemaRoleSelectProps) {
  const client = useRemoteApplicationGQLClient();
  const { data } = useGetRemoteAppRolesQuery({ client });
  const roles = getAdminRoles(data?.authRoles.map(({ role }) => role));

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-sm">Role</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label="Role" className="w-44">
          <SelectValue placeholder="Select role" />
        </SelectTrigger>
        <SelectContent>
          {roles.map((role) => (
            <SelectItem value={role} key={role}>
              {role}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
