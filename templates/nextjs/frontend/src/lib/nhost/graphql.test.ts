import { describe, expect, it } from 'vitest';
import { graphqlErrorMessage } from '@/lib/nhost/graphql';

describe('graphqlErrorMessage', () => {
  it('names the metadata when the schema lacks the field', () => {
    expect(
      graphqlErrorMessage([
        { message: "field 'updateUser' not found in type: 'mutation_root'" },
      ]),
    ).toContain('nhost/metadata');
  });

  it('passes any other message through', () => {
    expect(graphqlErrorMessage([{ message: 'check constraint' }])).toBe(
      'check constraint',
    );
  });

  it('has something to say when there were no errors to read', () => {
    expect(graphqlErrorMessage(undefined)).toBe('The backend did not answer.');
  });
});
