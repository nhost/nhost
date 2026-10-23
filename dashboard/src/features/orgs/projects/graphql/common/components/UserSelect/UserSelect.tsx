import debounce from 'lodash.debounce';
import { Check, ChevronDown } from 'lucide-react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { getAdminRoles } from '@/features/orgs/projects/roles/settings/utils/getAdminRoles';
import {
  type RemoteAppGetUsersAndAuthRolesQuery,
  useRemoteAppGetUsersAndAuthRolesLazyQuery,
} from '@/generated/graphql';
import { cn, isNotEmptyValue } from '@/lib/utils';

export interface UserSelectProps {
  /**
   * Function to be called when the user changes. The Admin pseudo-entry
   * emits an empty `userId` because it does not represent a real user.
   */
  onUserChange: (userId: string, availableRoles: string[]) => void;
  /**
   * Class name to be applied to the container element.
   */
  className?: string;
  /**
   * Shown on the trigger right after the user's name, e.g. " with role
   * user".
   */
  triggerSuffix?: ReactNode;
  /**
   * Extra content rendered in the popover below the user list, e.g. the
   * role picker.
   */
  children?: ReactNode;
}

export default function UserSelect({
  onUserChange,
  className,
  triggerSuffix,
  children,
}: UserSelectProps) {
  const [inputValue, setInputValue] = useState('');
  const [users, setUsers] = useState<
    RemoteAppGetUsersAndAuthRolesQuery['users']
  >([]);
  const [active, setActive] = useState(true);
  const [adminAuthRoles, setAdminAuthRoles] = useState<string[]>(() =>
    getAdminRoles(),
  ); // Roles from the auth.roles table
  const [selectedUserId, setSelectedUserId] = useState<string>('admin');
  // Display only: the selected user may drop out of `users` after a search.
  const [selectedLabel, setSelectedLabel] = useState('Admin');
  const [open, setOpen] = useState(false);

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
      const { data } = await fetchAppUsers({
        client: userApplicationClient,
        variables: {
          where: {
            displayName: { _ilike: ilike },
          },
          limit: 250,
          offset: 0,
        },
      });

      callback(data);
    },
    [fetchAppUsers, userApplicationClient],
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
    if (selectedUserId === 'admin') {
      onUserChange('', getAdminRoles(adminAuthRoles));
    }
  }, [adminAuthRoles]);

  const autocompleteOptions = [
    {
      value: 'admin',
      label: 'Admin',
      description: 'Admin secret, every permission',
      group: 'Admin',
    },
    ...users.map((user) => ({
      value: user.id,
      label: user.displayName || user.id,
      description: user.email ?? undefined,
      group: 'Users',
    })),
  ];

  const groupedOptions = [
    {
      heading: 'Admin',
      items: autocompleteOptions.filter((option) => option.group === 'Admin'),
    },
    {
      heading: 'Users',
      items: autocompleteOptions.filter((option) => option.group === 'Users'),
    },
  ].filter((group) => group.items.length > 0);

  const handleChange = (value: string, label: string) => {
    if (!value) {
      return;
    }
    setActive(false);
    setSelectedUserId(value);
    setSelectedLabel(label);

    if (value === 'admin') {
      onUserChange('', getAdminRoles(adminAuthRoles));
      return;
    }

    const user = users.find(({ id }) => id === value);
    if (user && isNotEmptyValue(user.roles)) {
      const roles = user.roles.map(({ role }) => role);
      onUserChange(value, roles);
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
        Request as
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-label={`Request as ${selectedLabel}`}
            data-testid="graphql-request-as-trigger"
            className="h-10 min-w-0 justify-start gap-2 pr-2 pl-3 font-normal"
          >
            <span className="truncate">
              <span className="font-medium text-foreground">
                {selectedLabel}
              </span>
              {triggerSuffix}
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          aria-label="Request as"
          className="w-80 p-0"
        >
          <Command>
            <CommandInput
              placeholder="Search users..."
              aria-label="Search users"
              className="h-9"
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              {groupedOptions.map(({ heading, items }) => (
                <CommandGroup key={heading} heading={heading}>
                  {items.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      keywords={[option.label]}
                      onSelect={() => handleChange(option.value, option.label)}
                      className="gap-2"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{option.label}</span>
                        {option.description && (
                          <span className="truncate text-muted-foreground text-xs">
                            {option.description}
                          </span>
                        )}
                      </span>
                      <Check
                        aria-hidden="true"
                        className={cn(
                          'ml-auto size-4 shrink-0 text-primary',
                          option.value === selectedUserId
                            ? 'opacity-100'
                            : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
          {children}
        </PopoverContent>
      </Popover>
    </div>
  );
}
