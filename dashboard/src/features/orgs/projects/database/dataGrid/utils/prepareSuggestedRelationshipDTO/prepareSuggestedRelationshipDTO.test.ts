import { describe, expect, it } from 'vitest';
import type {
  CreateLocalRelationshipArgs,
  SuggestedArrayRelationship,
  SuggestedObjectRelationship,
} from '@/utils/hasura-api/generated/schemas';
import prepareSuggestedRelationshipDTO from './prepareSuggestedRelationshipDTO';

const relationshipName = 'relationshipName';
const source = 'default';

describe('prepareSuggestedRelationshipDTO', () => {
  it('should create a valid object relationship DTO with manual configuration', () => {
    const arrayRelSuggestion: SuggestedArrayRelationship = {
      type: 'array',
      from: {
        table: {
          schema: 'public',
          name: 'authors',
        },
        columns: ['id'],
      },
      to: {
        table: {
          schema: 'public',
          name: 'books',
        },
        columns: ['author_id'],
        constraint_name: 'books_author_id_fkey',
      },
    };
    const result = prepareSuggestedRelationshipDTO({
      relationshipName,
      source,
      suggestion: arrayRelSuggestion,
      baseTable: {
        schema: 'public',
        name: 'authors',
      },
    });
    const expected: CreateLocalRelationshipArgs = {
      table: {
        schema: 'public',
        name: 'authors',
      },
      name: 'relationshipName',
      source: 'default',
      using: {
        foreign_key_constraint_on: {
          table: {
            schema: 'public',
            name: 'books',
          },
          columns: ['author_id'],
        },
      },
    };
    expect(result).toEqual(expected);
  });

  it('should create a valid object relationship DTO from a suggested relationship', () => {
    const objectRelSuggestion: SuggestedObjectRelationship = {
      type: 'object',
      from: {
        table: {
          schema: 'public',
          name: 'books',
        },
        columns: ['author_id'],
        constraint_name: 'books_author_id_fkey',
      },
      to: {
        table: {
          schema: 'public',
          name: 'authors',
        },
        columns: ['id'],
      },
    };

    const result = prepareSuggestedRelationshipDTO({
      relationshipName,
      source,
      suggestion: objectRelSuggestion,
      baseTable: {
        schema: 'public',
        name: 'books',
      },
    });
    const expected: CreateLocalRelationshipArgs = {
      table: {
        schema: 'public',
        name: 'books',
      },
      name: 'relationshipName',
      source: 'default',
      using: {
        foreign_key_constraint_on: ['author_id'],
      },
    };
    expect(result).toEqual(expected);
  });
});
