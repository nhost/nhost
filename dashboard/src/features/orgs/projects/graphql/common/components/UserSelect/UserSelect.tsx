import { debounce } from '@mui/material/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Combobox } from '@/components/ui/v3/combobox';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { getAdminRoles } from '@/features/orgs/projects/roles/settings/utils/getAdminRoles';
import { cn, isNotEmptyValue } from '@/lib/utils';
import {
  type RemoteAppGetUsersAndAuthRolesQuery,
  useRemoteAppGetUsersAndAuthRolesLazyQuery,
} from '@/utils/__generated__/graphql';

export interface UserSelectProps {
  /**
   * Function to be called when the user changes.
   */
  onUserChange: (userId: string, availableRoles: string[]) => void;
  /**
   * Class name to be applied to the container element.
   */
  className?: string;
  /**
   * Pre-select this user id on mount. The component fetches the user (in
   * addition to the regular paged list) and emits an `onUserChange` with
   * its roles once the data is available.
   */
  initialUserId?: string;
}

export default function UserSelect({
  onUserChange,
  className,
  initialUserId,
  ...props
}: UserSelectProps) {
  const [inputValue, setInputValue] = useState('');
  const [users, setUsers] = useState<
    RemoteAppGetUsersAndAuthRolesQuery['users']
  >([]);
  const [active, setActive] = useState(true);
  const [adminAuthRoles, setAdminAuthRoles] = useState<string[]>(() =>
    getAdminRoles(),
  );
  const [selectedUserId, setSelectedUserId] = useState<string>(() =>
    initialUserId && initialUserId !== 'admin' ? initialUserId : 'admin',
  );
  const initialUserAppliedRef = useRef(false);

  const userApplicationClient = useRemoteApplicationGQLClient();

  const [fetchAppUsers] = useRemoteAppGetUsersAndAuthRolesLazyQuery({
    client: userApplicationClient,
    variables: {
      where: {},
      limit: 250,
      offset: 0,
    },
  });

  const fetchUsers = useCallback(
    async (
      request: { input: string },
      callback: (results?: RemoteAppGetUsersAndAuthRolesQuery) => void,
    ) => {
      const ilike = `%${request.input === 'Admin' ? '' : request.input}%`;
      const where =
        initialUserId && initialUserId !== 'admin'
          ? {
              _or: [
                { displayName: { _ilike: ilike } },
                { id: { _eq: initialUserId } },
              ],
            }
          : { displayName: { _ilike: ilike } };
      const { data } = await fetchAppUsers({
        client: userApplicationClient,
        variables: {
          where,
          limit: 250,
          offset: 0,
        },
      });

      callback(data);
    },
    [fetchAppUsers, userApplicationClient, initialUserId],
  );

  const fetchOptions = useMemo(() => debounce(fetchUsers, 1000), [fetchUsers]);

  useEffect(() => {
    fetchOptions({ input: inputValue }, (results) => {
      if (active || inputValue === '') {
        if (
          isNotEmptyValue(results?.users) &&
          isNotEmptyValue(results?.authRoles)
        ) {
          setUsers(results.users);
          const newAuthRoles = results.authRoles.map(
            (authRole) => authRole.role,
          );
          setAdminAuthRoles(newAuthRoles);
        } else {
          setUsers([]);
          setAdminAuthRoles(getAdminRoles());
        }
      }
    });
  }, [inputValue, fetchOptions, active]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: only want to run the effect when adminAuthRoles changes
  useEffect(() => {
    if (initialUserId && initialUserId !== 'admin') {
      return;
    }
    onUserChange('admin', getAdminRoles(adminAuthRoles));
  }, [adminAuthRoles]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: apply pre-selected user once data is in
  useEffect(() => {
    if (
      !initialUserId ||
      initialUserId === 'admin' ||
      initialUserAppliedRef.current
    ) {
      return;
    }
    const user = users.find(({ id }) => id === initialUserId);
    if (!user) {
      return;
    }
    initialUserAppliedRef.current = true;
    setSelectedUserId(user.id);
    if (isNotEmptyValue(user.roles)) {
      onUserChange(
        user.id,
        user.roles.map(({ role }) => role),
      );
    } else {
      onUserChange(user.id, []);
    }
  }, [users, initialUserId]);

  const autocompleteOptions = [
    {
      value: 'admin',
      label: 'Admin',
      group: 'Admin',
    },
    ...users.map((user) => ({
      value: user.id,
      label: user.displayName || user.id,
      group: 'Users',
    })),
  ];

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
        Make request as
      </span>
      <Combobox
        {...props}
        value={selectedUserId}
        onChange={(value) => {
          if (!value) {
            return;
          }
          setActive(false);
          setSelectedUserId(value);

          if (value === 'admin') {
            onUserChange('admin', getAdminRoles(adminAuthRoles));
            return;
          }

          const user = users.find(({ id }) => id === value);
          if (user && isNotEmptyValue(user.roles)) {
            const roles = user.roles.map(({ role }) => role);
            onUserChange(value, roles);
          }
        }}
        options={autocompleteOptions}
        placeholder="Select user..."
        className="w-full"
        popoverContentClassName="w-80"
        onSearchChange={setInputValue}
      />
    </div>
  );
}
