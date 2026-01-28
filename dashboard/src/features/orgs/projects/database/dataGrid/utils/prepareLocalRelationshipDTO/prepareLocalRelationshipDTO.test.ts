import { describe, expect, it } from 'vitest';
import type { TableRelationshipFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import type { CreateLocalRelationshipArgs } from '@/utils/hasura-api/generated/schemas';
import prepareLocalRelationshipDTO from './prepareLocalRelationshipDTO';

describe('prepareLocalRelationshipDTO', () => {
  it('should create a valid object relationship DTO with manual configuration', () => {
    const values: TableRelationshipFormValues = {
      name: 'relationshipName',
      referenceKind: 'table',
      fromSource: {
        schema: 'public',
        table: 'books',
        source: 'default',
      },
      toReference: {
        schema: 'public',
        table: 'authors',
        source: 'default',
      },
      relationshipType: 'object',
      fieldMapping: [
        {
          sourceColumn: 'author_id',
          referenceColumn: 'id',
        },
      ],
    };
    const result = prepareLocalRelationshipDTO(values);
    const expected: CreateLocalRelationshipArgs = {
      table: {
        name: 'books',
        schema: 'public',
      },
      name: 'relationshipName',
      source: 'default',
      using: {
        manual_configuration: {
          remote_table: {
            name: 'authors',
            schema: 'public',
          },
          column_mapping: {
            author_id: 'id',
          },
        },
      },
    };
    expect(result).toEqual(expected);
  });

  it('should create a valid array relationship DTO with manual configuration', () => {
    const values: TableRelationshipFormValues = {
      name: 'relationshipName',
      referenceKind: 'table',
      fromSource: {
        schema: 'public',
        table: 'authors',
        source: 'default',
      },
      toReference: {
        schema: 'public',
        table: 'books',
        source: 'default',
      },
      relationshipType: 'array',
      fieldMapping: [
        {
          sourceColumn: 'id',
          referenceColumn: 'author_id',
        },
      ],
    };
    const result = prepareLocalRelationshipDTO(values);
    const expected: CreateLocalRelationshipArgs = {
      table: {
        name: 'authors',
        schema: 'public',
      },
      name: 'relationshipName',
      source: 'default',
      using: {
        manual_configuration: {
          remote_table: {
            name: 'books',
            schema: 'public',
          },
          column_mapping: {
            id: 'author_id',
          },
        },
      },
    };
    expect(result).toEqual(expected);
  });
});
