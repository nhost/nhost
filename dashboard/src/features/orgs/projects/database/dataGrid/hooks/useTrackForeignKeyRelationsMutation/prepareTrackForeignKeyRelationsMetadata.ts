import { fetchMetadata } from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';
import type {
  ForeignKeyRelation,
  HasuraMetadataRelationship,
  MutationOrQueryBaseOptions,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { singular } from 'pluralize';

export type ForeignKeyMetadataOperation =
  | {
      type: 'pg_create_object_relationship' | 'pg_create_array_relationship';
      args: HasuraMetadataRelationship & {
        source: string;
        table: { name: string; schema: string };
      };
    }
  | {
      type: 'pg_drop_relationship';
      args: {
        source: string;
        table: string;
        relationship: string;
        cascade: boolean;
      };
    };

export interface PrepareTrackForeignKeyRelationsMetadataVariables
  extends MutationOrQueryBaseOptions {
  /**
   * Foreign key relation to track.
   */
  foreignKeyRelations: ForeignKeyRelation[];
}

export default async function prepareTrackForeignKeyRelationsMetadata({
  dataSource,
  appUrl,
  adminSecret,
  schema,
  table,
  foreignKeyRelations,
}: PrepareTrackForeignKeyRelationsMetadataVariables) {
  const metadata = await fetchMetadata({ dataSource, appUrl, adminSecret });
  const { tables: tablesInMetadata } = metadata || {};

  const foreignKeyRelationsMap = foreignKeyRelations.reduce(
    (map, foreignKeyRelation) => {
      if (!foreignKeyRelation) {
        return map;
      }

      return map.set(
        `${foreignKeyRelation.referencedSchema}.${foreignKeyRelation.referencedTable}`,
        foreignKeyRelation,
      );
    },
    new Map<string, ForeignKeyRelation>(),
  );

  const existingRelationshipMap = tablesInMetadata
    .filter(
      ({ table: { name: tableName, schema: tableSchema } }) =>
        (tableName === table && tableSchema === schema) ||
        foreignKeyRelationsMap.has(`${tableSchema}.${tableName}`),
    )
    .reduce((relationshipMap, tableInMetadata) => {
      tableInMetadata.array_relationships?.forEach((relationship) => {
        relationshipMap.set(relationship.name, relationship);
      });

      tableInMetadata.object_relationships?.forEach((relationship) => {
        relationshipMap.set(relationship.name, relationship);
      });

      return relationshipMap;
    }, new Map<string, HasuraMetadataRelationship>());

  if (!foreignKeyRelations) {
    return [];
  }

  return foreignKeyRelations.reduce((args, foreignKeyRelation) => {
    const baseRelationshipName = singular(foreignKeyRelation.referencedTable);

    let relationships = [].concat(args);

    if (existingRelationshipMap.has(baseRelationshipName)) {
      relationships = relationships.concat({
        type: 'pg_drop_relationship',
        args: {
          source: dataSource,
          table,
          relationship: baseRelationshipName,
          cascade: false,
        },
      });
    }

    relationships = relationships.concat({
      type: 'pg_create_object_relationship',
      args: {
        source: dataSource,
        name: baseRelationshipName,
        table: {
          name: table,
          schema,
        },
        using: {
          foreign_key_constraint_on: foreignKeyRelation.columnName,
        },
      },
    });

    if (foreignKeyRelation.oneToOne) {
      const oneToOneRelationshipName = singular(table);

      if (existingRelationshipMap.has(oneToOneRelationshipName)) {
        relationships = relationships.concat({
          type: 'pg_drop_relationship',
          args: {
            source: dataSource,
            table: foreignKeyRelation.referencedTable,
            relationship: oneToOneRelationshipName,
            cascade: false,
          },
        });
      }

      return relationships.concat({
        type: 'pg_create_object_relationship',
        args: {
          source: dataSource,
          name: oneToOneRelationshipName,
          table: {
            name: foreignKeyRelation.referencedTable,
            schema: foreignKeyRelation.referencedSchema || schema,
          },
          using: {
            foreign_key_constraint_on: {
              table: { name: table, schema },
              column: foreignKeyRelation.columnName,
            },
          },
        },
      });
    }

    const oneToManyRelationshipName = table;

    if (existingRelationshipMap.has(oneToManyRelationshipName)) {
      relationships = relationships.concat({
        type: 'pg_drop_relationship',
        args: {
          source: dataSource,
          table: foreignKeyRelation.referencedSchema
            ? {
                name: foreignKeyRelation.referencedTable,
                schema: foreignKeyRelation.referencedSchema,
              }
            : foreignKeyRelation.referencedTable,
          relationship: oneToManyRelationshipName,
          cascade: false,
        },
      });
    }

    return relationships.concat({
      type: 'pg_create_array_relationship',
      args: {
        source: dataSource,
        name: oneToManyRelationshipName,
        table: {
          schema: foreignKeyRelation.referencedSchema || schema,
          name: foreignKeyRelation.referencedTable,
        },
        using: {
          foreign_key_constraint_on: {
            table: { name: table, schema },
            column: foreignKeyRelation.columnName,
          },
        },
      },
    });
  }, [] as ForeignKeyMetadataOperation[]);
}
