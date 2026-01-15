import { describe, expect, it } from 'vitest';
import { ReferenceSource } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import { isRemoteSchemaRelationshipFormValues, isTableRelationshipFormValues } from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import type { RemoteRelationshipDefinition } from '@/utils/hasura-api/generated/schemas';
import parseRemoteRelationshipFormDefaultValues from './parseRemoteRelationshipFormDefaultValues';

describe('parseRemoteRelationshipFormDefaultValues', () => {
  const baseParams = {
    schema: 'public',
    tableName: 'users',
    source: 'default',
    relationshipName: 'userProfile',
  };

  describe('to_source relationship definition', () => {
    it('should parse a to_source relationship with object relationship type', () => {
      const definition: RemoteRelationshipDefinition = {
        to_source: {
          source: 'externaldb',
          table: {
            name: 'profiles',
            schema: 'public',
          },
          relationship_type: 'object',
          field_mapping: {
            user_id: 'id',
            email: 'email',
          },
        },
      };

      const result = parseRemoteRelationshipFormDefaultValues({
        ...baseParams,
        definition,
      });

      expect(result).toEqual({
        name: 'userProfile',
        referenceKind: 'table',
        fromSource: {
          schema: 'public',
          table: 'users',
          source: 'default',
        },
        toReference: {
          schema: 'public',
          table: 'profiles',
          source: ReferenceSource.createTypeSourceFromName('externaldb').fullValue,
        },
        relationshipType: 'object',
        fieldMapping: [
          {
            sourceColumn: 'user_id',
            referenceColumn: 'id',
          },
          {
            sourceColumn: 'email',
            referenceColumn: 'email',
          },
        ],
      });
    });

    it('should parse a to_source relationship with array relationship type', () => {
      const definition: RemoteRelationshipDefinition = {
        to_source: {
          source: 'externaldb',
          table: {
            name: 'orders',
            schema: 'commerce',
          },
          relationship_type: 'array',
          field_mapping: {
            user_id: 'customer_id',
          },
        },
      };

      const result = parseRemoteRelationshipFormDefaultValues({
        ...baseParams,
        definition,
      });

      expect(result).toEqual({
        name: 'userProfile',
        referenceKind: 'table',
        fromSource: {
          schema: 'public',
          table: 'users',
          source: 'default',
        },
        toReference: {
          schema: 'commerce',
          table: 'orders',
          source: ReferenceSource.createTypeSourceFromName('externaldb').fullValue,
        },
        relationshipType: 'array',
        fieldMapping: [
          {
            sourceColumn: 'user_id',
            referenceColumn: 'customer_id',
          },
        ],
      });
    });

    it('should handle empty field_mapping', () => {
      const definition: RemoteRelationshipDefinition = {
        to_source: {
          source: 'externaldb',
          table: {
            name: 'profiles',
            schema: 'public',
          },
          relationship_type: 'object',
          field_mapping: {},
        },
      };

      const result = parseRemoteRelationshipFormDefaultValues({
        ...baseParams,
        definition,
      });

      expect(isTableRelationshipFormValues(result)).toBe(true);
      if (isTableRelationshipFormValues(result)) {
        expect(result.fieldMapping).toEqual([]);
      }
    });

    it('should handle missing table schema', () => {
      const definition: RemoteRelationshipDefinition = {
        to_source: {
          source: 'externaldb',
          table: {
            name: 'profiles',
            schema: undefined as unknown as string,
          },
          relationship_type: 'object',
          field_mapping: {
            user_id: 'id',
          },
        },
      };

      const result = parseRemoteRelationshipFormDefaultValues({
        ...baseParams,
        definition,
      });

      expect(isTableRelationshipFormValues(result)).toBe(true);
      if (isTableRelationshipFormValues(result)) {
        expect(result.toReference.schema).toBe('');
      }
    });

    it('should handle missing table name', () => {
      const definition: RemoteRelationshipDefinition = {
        to_source: {
          source: 'externaldb',
          table: {
            name: undefined as unknown as string,
            schema: 'public',
          },
          relationship_type: 'object',
          field_mapping: {
            user_id: 'id',
          },
        },
      };

      const result = parseRemoteRelationshipFormDefaultValues({
        ...baseParams,
        definition,
      });

      expect(isTableRelationshipFormValues(result)).toBe(true);
      if (isTableRelationshipFormValues(result)) {
        expect(result.toReference.table).toBe('');
      }
    });

    it('should handle case-insensitive relationship_type', () => {
      const definition: RemoteRelationshipDefinition = {
        to_source: {
          source: 'externaldb',
          table: {
            name: 'profiles',
            schema: 'public',
          },
          relationship_type: 'ARRAY' as 'array' | 'object',
          field_mapping: {
            user_id: 'id',
          },
        },
      };

      const result = parseRemoteRelationshipFormDefaultValues({
        ...baseParams,
        definition,
      });

      expect(isTableRelationshipFormValues(result)).toBe(true);
      if (isTableRelationshipFormValues(result)) {
        expect(result.relationshipType).toBe('array');
      }
    });
  });

  describe('to_remote_schema relationship definition', () => {
    it('should parse a to_remote_schema relationship', () => {
      const definition: RemoteRelationshipDefinition = {
        to_remote_schema: {
          remote_schema: 'user-remote-schema',
          lhs_fields: ['user_id', 'email'],
          remote_field: {
            user: {
              arguments: {
                id: '$user_id',
                email: '$email',
              },
            },
          },
        },
      };

      const result = parseRemoteRelationshipFormDefaultValues({
        ...baseParams,
        definition,
      });

      expect(result).toEqual({
        name: 'userProfile',
        referenceKind: 'remoteSchema',
        fromSource: {
          schema: 'public',
          table: 'users',
          source: 'default',
        },
        toReference: {
          source: ReferenceSource.createTypeRemoteSchemaFromName(
            'user-remote-schema',
          ).fullValue,
        },
        remoteSchema: {
          name: 'user-remote-schema',
          lhsFields: ['user_id', 'email'],
          remoteField: {
            user: {
              arguments: {
                id: '$user_id',
                email: '$email',
              },
            },
          },
        },
      });
    });

    it('should handle empty lhs_fields', () => {
      const definition: RemoteRelationshipDefinition = {
        to_remote_schema: {
          remote_schema: 'user-remote-schema',
          lhs_fields: [],
          remote_field: {
            user: {},
          },
        },
      };

      const result = parseRemoteRelationshipFormDefaultValues({
        ...baseParams,
        definition,
      });

      expect(isRemoteSchemaRelationshipFormValues(result)).toBe(true);
      if (isRemoteSchemaRelationshipFormValues(result)) {
        expect(result.remoteSchema.lhsFields).toEqual([]);
      }
    });

    it('should handle remote_field without arguments', () => {
      const definition: RemoteRelationshipDefinition = {
        to_remote_schema: {
          remote_schema: 'user-remote-schema',
          lhs_fields: ['user_id'],
          remote_field: {
            user: {},
          },
        },
      };

      const result = parseRemoteRelationshipFormDefaultValues({
        ...baseParams,
        definition,
      });

      expect(isRemoteSchemaRelationshipFormValues(result)).toBe(true);
      if (isRemoteSchemaRelationshipFormValues(result)) {
        expect(result.remoteSchema.remoteField).toEqual({
          user: {},
        });
      }
    });

    it('should handle nested remote_field', () => {
      const definition: RemoteRelationshipDefinition = {
        to_remote_schema: {
          remote_schema: 'order-remote-schema',
          lhs_fields: ['order_id'],
          remote_field: {
            order: {
              arguments: {
                id: '$order_id',
              },
              field: {
                items: {
                  arguments: {
                    limit: 10,
                  },
                },
              },
            },
          },
        },
      };

      const result = parseRemoteRelationshipFormDefaultValues({
        ...baseParams,
        definition,
      });

      expect(isRemoteSchemaRelationshipFormValues(result)).toBe(true);
      if (isRemoteSchemaRelationshipFormValues(result)) {
        expect(result.remoteSchema.remoteField).toEqual({
          order: {
            arguments: {
              id: '$order_id',
            },
            field: {
              items: {
                arguments: {
                  limit: 10,
                },
              },
            },
          },
        });
      }
    });
  });

  describe('fallback behavior', () => {
    it('should return defaultFormValues for unknown definition type', () => {
      const definition = {} as RemoteRelationshipDefinition;

      const result = parseRemoteRelationshipFormDefaultValues({
        ...baseParams,
        definition,
      });

      expect(result).toEqual({
        name: '',
        fromSource: {
          schema: '',
          table: '',
          source: '',
        },
        referenceKind: 'table',
        toReference: {
          source: '',
          schema: '',
          table: '',
        },
        relationshipType: 'object',
        fieldMapping: [],
      });
    });
  });
});
