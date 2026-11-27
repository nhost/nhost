import { Order_By } from '@/generated/graphql';
import getUsersOrderBy, {
  DEFAULT_USERS_SORT,
  getNextUsersSort,
} from './getUsersOrderBy';

describe('getUsersOrderBy', () => {
  it('sorts by creation date, newest first, by default', () => {
    expect(getUsersOrderBy(DEFAULT_USERS_SORT)).toEqual([
      { createdAt: Order_By.DescNullsLast },
      { id: Order_By.Asc },
    ]);
  });

  it('sorts by last seen with users that never signed in last', () => {
    expect(getUsersOrderBy({ column: 'lastSeen', direction: 'desc' })).toEqual([
      { lastSeen: Order_By.DescNullsLast },
      { id: Order_By.Asc },
    ]);
    expect(getUsersOrderBy({ column: 'lastSeen', direction: 'asc' })).toEqual([
      { lastSeen: Order_By.AscNullsLast },
      { id: Order_By.Asc },
    ]);
  });
});

describe('getNextUsersSort', () => {
  it('toggles the direction when the sorted column is clicked again', () => {
    expect(
      getNextUsersSort({ column: 'lastSeen', direction: 'desc' }, 'lastSeen'),
    ).toEqual({ column: 'lastSeen', direction: 'asc' });
    expect(
      getNextUsersSort({ column: 'lastSeen', direction: 'asc' }, 'lastSeen'),
    ).toEqual({ column: 'lastSeen', direction: 'desc' });
  });

  it('starts with the most recent values when another column is clicked', () => {
    expect(getNextUsersSort(DEFAULT_USERS_SORT, 'lastSeen')).toEqual({
      column: 'lastSeen',
      direction: 'desc',
    });
    expect(
      getNextUsersSort({ column: 'lastSeen', direction: 'asc' }, 'createdAt'),
    ).toEqual({ column: 'createdAt', direction: 'desc' });
  });
});
