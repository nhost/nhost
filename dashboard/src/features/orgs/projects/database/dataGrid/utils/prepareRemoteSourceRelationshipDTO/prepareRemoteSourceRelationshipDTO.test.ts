import { describe, it } from 'vitest';
import type { TableRelationshipFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import type { CreateRemoteRelationshipArgs } from '@/utils/hasura-api/generated/schemas';
import prepareRemoteSourceRelationshipDTO from './prepareRemoteSourceRelationshipDTO';

describe('prepareRemoteSourceRelationshipDTO', () => {
  it('should create a valid remote source relationship DTO for an object relationship', () => {
    const values: TableRelationshipFormValues = {
      name: 'relationshipName',
      referenceKind: 'table',
      fromSource: {
        schema: 'public',
        table: 'users',
        source: 'default',
      },
      toReference: {
        schema: 'public',
        table: 'externaltable',
        source:
          'externaldb',
      },
      relationshipType: 'object',
      fieldMapping: [
        {
          sourceColumn: 'user_id',
          referenceColumn: 'id',
        },
        {
          sourceColumn: 'team_id',
          referenceColumn: 'team_id',
        },
      ],
    };
    const result = prepareRemoteSourceRelationshipDTO(values);
    const expected: CreateRemoteRelationshipArgs = {
      name: 'relationshipName',
      source: 'default',
      table: {
        name: 'users',
        schema: 'public',
      },
      definition: {
        to_source: {
          relationship_type: 'object',
          source: 'externaldb',
          table: {
            name: 'externaltable',
            schema: 'public',
          },
          field_mapping: {
            user_id: 'id',
            team_id: 'team_id',
          },
        },
      },
    };
    expect(result).toEqual(expected);
  });
});
