import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Avatar } from '@/ui/Avatar';
import { Text } from '@/ui/Text';
import IconButton from '@/ui/v2/IconButton';
import CopyIcon from '@/ui/v2/icons/CopyIcon';
import { copy } from '@/utils/copy';
import type { Users as UsersType } from '@/utils/__generated__/graphql';
import { useRemoteAppGetUsersQuery } from '@/utils/__generated__/graphql';
import { ChevronRightIcon } from '@heroicons/react/solid';
import { format } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/router';
import * as React from 'react';

type UsersTableProps = {
  searchQuery: string;
  currentPage: number;
  setCurrentPage: Function;
  totalNrOfPages: number;
  setTotalNrOfPages: Function;
};

function Users({ users }: any) {
  const {
    query: { workspaceSlug, appSlug },
  } = useRouter();
  return (
    <tbody className="divide-y divide-gray-200">
      {users.map((user: UsersType) => (
        <Link
          href={`/${workspaceSlug}/${appSlug}/users/${user.id}`}
          key={user.id}
          passHref
        >
          <tr className="w-52 cursor-pointer">
            <td className="whitespace-nowrap py-1 pr-6">
              <div className="flex items-center">
                <IconButton
                  variant="borderless"
                  color="secondary"
                  className="mr-2 p-1"
                  aria-label="Copy user ID"
                  onClick={(event) => {
                    event.stopPropagation();
                    copy(user.id, `User ID`);
                  }}
                >
                  <CopyIcon className="h-4 w-4" />
                </IconButton>

                <div className="h-8 w-8 flex-shrink-0">
                  <Avatar
                    className="h-8 w-8"
                    avatarUrl={user.avatarUrl}
                    name={user.displayName}
                  />
                </div>
                <div className="ml-2">
                  <Link
                    passHref
                    href={`/${workspaceSlug}/${appSlug}/users/${user.id}`}
                  >
                    <Text
                      variant="a"
                      color="greyscaleDark"
                      className="cursor-pointer font-medium"
                      size="normal"
                    >
                      {user.displayName ||
                        user.email ||
                        user.phoneNumber ||
                        user.id}
                    </Text>
                  </Link>
                  <Text color="grey" className="font-normal" size="tiny">
                    {user.email || user.phoneNumber || user.id}
                  </Text>
                </div>
              </div>
            </td>
            <td className="whitespace-nowrap px-6 py-4">
              <Text color="greyscaleDark" className="font-normal" size="normal">
                {format(new Date(user.createdAt), 'd MMM yyyy')}
              </Text>
            </td>
            <td className="flex flex-row self-center px-6 py-4">
              {user.roles.map((role, index) => {
                const renderDot = user.roles.length - 1 !== index;
                return (
                  <Text
                    color="greyscaleDark"
                    className="self-center font-medium"
                    size="tiny"
                    key={role.role}
                  >
                    {role.role}{' '}
                    {renderDot && (
                      <span className="ml-1 mr-1.5 text-xs text-greyscaleGrey">
                        •
                      </span>
                    )}
                  </Text>
                );
              })}
            </td>
            <td className="whitespace-nowrap py-4 pl-6 text-right text-sm font-medium">
              <Link
                href={`/${workspaceSlug}/${appSlug}/users/${user.id}`}
                passHref
              >
                <a href={`${workspaceSlug}/${appSlug}/users/${user.id}`}>
                  <ChevronRightIcon className="ml-2 h-4 w-4 cursor-pointer self-center" />
                </a>
              </Link>
            </td>
          </tr>
        </Link>
      ))}
    </tbody>
  );
}
function UserPages({ totalNrOfPages, setCurrentPage }: any) {
  return (
    <div className="flex justify-center py-3">
      {Array.from(
        {
          length: totalNrOfPages,
        },
        (_, i) => i + 1,
      ).map((i) => (
        <button
          type="button"
          key={i}
          className="cursor-pointer px-2"
          onClick={() => {
            setCurrentPage(i);
          }}
        >
          {i}
        </button>
      ))}
    </div>
  );
}
function TotalUsers({
  setTotalNrOfPages,
  totalNrOfUsers,
  limit,
  searchQuery,
  length,
}: any) {
  React.useEffect(() => {
    setTotalNrOfPages(Math.ceil(totalNrOfUsers / limit));
  }, [limit, setTotalNrOfPages, totalNrOfUsers]);

  return (
    <div>
      {searchQuery === '' ? (
        <div className="w-52">
          <Text size="tiny" color="greyscaleDark" className="font-bold">
            {totalNrOfUsers} accounts in total
          </Text>
        </div>
      ) : (
        <div>
          Showing {length}/{totalNrOfUsers} users
        </div>
      )}
    </div>
  );
}

export function UsersTable({
  searchQuery,
  currentPage,
  setCurrentPage,
  totalNrOfPages,
  setTotalNrOfPages,
}: UsersTableProps) {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const limit = 20;

  const offset = currentPage - 1;

  const { data, error } = useRemoteAppGetUsersQuery({
    variables: {
      where: {
        _or: [
          {
            displayName: {
              _like: `%${searchQuery}%`,
            },
          },
          {
            email: {
              _like: `%${searchQuery}%`,
            },
          },
        ],
      },
      limit,
      offset: offset * limit,
    },
    skip:
      !currentApplication?.subdomain &&
      !currentApplication?.hasuraGraphqlAdminSecret,
  });

  if (error) {
    throw error;
  }

  return (
    <div className="mt-2 flex flex-col font-display">
      <div className="align- inline-block min-w-full py-2">
        <div className="overflow-hidden border-b">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium tracking-wider text-dark"
                >
                  {data ? (
                    <TotalUsers
                      searchQuery={searchQuery}
                      length={data.users.length}
                      totalNrOfUsers={data?.usersAggregate?.aggregate!.count}
                      setTotalNrOfPages={setTotalNrOfPages}
                      limit={limit}
                    />
                  ) : (
                    <div className="w-52">
                      <Text
                        size="tiny"
                        color="greyscaleDark"
                        className="font-bold"
                      >
                        - accounts in total
                      </Text>
                    </div>
                  )}
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium tracking-wider text-dark"
                >
                  <Text size="tiny" color="greyscaleDark" className="font-bold">
                    Signed up at
                  </Text>
                </th>

                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium tracking-wider text-dark"
                >
                  <Text size="tiny" color="greyscaleDark" className="font-bold">
                    Roles
                  </Text>
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            {data && <Users users={data.users} />}
          </table>
        </div>
        {data && (
          <UserPages
            setCurrentPage={setCurrentPage}
            totalNrOfPages={totalNrOfPages}
          />
        )}
      </div>
    </div>
  );
}

export default UsersTable;
