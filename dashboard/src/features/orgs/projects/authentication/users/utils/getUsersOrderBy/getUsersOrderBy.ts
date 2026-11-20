import { Order_By, type Users_Order_By } from '@/generated/graphql';

export type UsersSortColumn = 'createdAt' | 'lastSeen';
export type UsersSortDirection = 'asc' | 'desc';

export interface UsersSort {
  column: UsersSortColumn;
  direction: UsersSortDirection;
}

export const DEFAULT_USERS_SORT: UsersSort = {
  column: 'createdAt',
  direction: 'desc',
};

/**
 * Builds the `order_by` argument for the users query. Users without a value
 * for the sorted column (e.g. users that never signed in have no `lastSeen`)
 * are always placed last, and the id is used as a tiebreaker so pagination
 * stays stable when several users share the same value.
 */
export default function getUsersOrderBy({
  column,
  direction,
}: UsersSort): Users_Order_By[] {
  return [
    {
      [column]: direction === 'asc' ? Order_By.AscNullsLast : Order_By.DescNullsLast,
    },
    { id: Order_By.Asc },
  ];
}

/**
 * Returns the sort to apply after the header of `column` was clicked: toggles
 * the direction when the column is already sorted, otherwise starts with the
 * most recent values first.
 */
export function getNextUsersSort(
  current: UsersSort,
  column: UsersSortColumn,
): UsersSort {
  if (current.column === column) {
    return {
      column,
      direction: current.direction === 'desc' ? 'asc' : 'desc',
    };
  }

  return { column, direction: 'desc' };
}
