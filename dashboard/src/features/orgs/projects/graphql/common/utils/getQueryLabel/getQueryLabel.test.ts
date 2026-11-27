import { getQueryLabel } from './getQueryLabel';

describe('getQueryLabel', () => {
  it('uses the operation name', () => {
    expect(getQueryLabel('query Users { users { id } }')).toBe('Users');
  });

  it('uses the first field of an unnamed query', () => {
    expect(getQueryLabel('{ buckets { id } }')).toBe('buckets');
  });

  it('reads the first field while the query is still being typed', () => {
    expect(getQueryLabel('{ files(limit: 3) { id')).toBe('files');
  });

  it('calls an empty query "New query"', () => {
    expect(getQueryLabel('  ')).toBe('New query');
    expect(getQueryLabel(null)).toBe('New query');
  });
});
