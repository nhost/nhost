import { logger } from '@/logger';
import { exportMetadata, replaceMetadata } from './api';
import { HasuraMetadataV3, QualifiedTable, TableEntry } from './types';

const getSource = (metadata: HasuraMetadataV3, source = 'default') => {
  const sourceObject = metadata.sources.find((s) => s.name === source);
  if (!sourceObject) {
    throw Error(`Source ${source} not found`);
  }
  return sourceObject;
};

/**
 * Modify a metadata object in-place and add a table to it
 * If the table exists, it will be overwritten,
 * and the missing relationships will be added
 */
export const patchTableObject = (
  metadata: HasuraMetadataV3,
  tableEntry: TableEntry,
  source = 'default'
): void => {
  const sourceObject = getSource(metadata, source);
  const existingTable = sourceObject.tables.find(
    (t) =>
      t.table.name === tableEntry.table.name &&
      t.table.schema === tableEntry.table.schema
  );

  if (!existingTable) {
    sourceObject.tables.push(tableEntry);

    return;
  }

  const {
    array_relationships,
    object_relationships,
    select_permissions,
    delete_permissions,
    configuration,
  } = tableEntry;

  // * Merge the new table entry with the existing one
  if (array_relationships) {
    const existingRelationships = existingTable.array_relationships;
    if (existingRelationships) {
      // * Merge array_relationships
      array_relationships.forEach((addedRel) => {
        const existingRel = existingRelationships.find(
          (c) => c.name === addedRel.name
        );
        if (existingRel) {
          existingRel.comment = addedRel.comment;
          existingRel.using = addedRel.using;
        } else {
          existingRelationships.push(addedRel);
        }
      });
    } else {
      // * No existing relationships: add all the new ones
      existingTable.array_relationships = [...array_relationships];
    }
  }
  if (object_relationships) {
    const existingRelationships = existingTable.object_relationships;
    if (existingRelationships) {
      // * Merge object_relationships
      object_relationships.forEach((addedRel) => {
        const existingRel = existingRelationships.find(
          (c) => c.name === addedRel.name
        );
        if (existingRel) {
          existingRel.comment = addedRel.comment;
          existingRel.using = addedRel.using;
        } else {
          existingRelationships.push(addedRel);
        }
      });
    } else {
      // * No existing relationships: add all the new ones
      existingTable.object_relationships = [...object_relationships];
    }
  }
  if (configuration) {
    if (!existingTable.configuration) {
      existingTable.configuration = configuration;
    }

    // * Merge table configuration
    const existingConfig = existingTable.configuration;

    // * Change custom name if not already set
    if (configuration.custom_name) {
      existingConfig.custom_name = configuration.custom_name;
    }

    // * Add/replace column configurations
    existingConfig.column_config = {
      ...existingConfig.column_config,
      ...configuration.column_config,
    };

    // * Add/replace custom column names
    existingConfig.custom_column_names = {
      ...existingConfig.custom_column_names,
      ...configuration.custom_column_names,
    };

    // * Add/replace custom root fields
    existingConfig.custom_root_fields = {
      ...existingConfig.custom_root_fields,
      ...configuration.custom_root_fields,
    };
  }

  if (select_permissions) {
    const mergedSelectPermissions = [...(existingTable.select_permissions ?? []), ...select_permissions];
    existingTable.select_permissions = [
      ...new Map(mergedSelectPermissions.map((permission) => [permission.role, permission])).values()
    ];
  }

  if (delete_permissions) {
    const mergedDeletePermissions = [...(existingTable.delete_permissions ?? []), ...delete_permissions];
    existingTable.delete_permissions = [
      ...new Map(mergedDeletePermissions.map((permission) => [permission.role, permission])).values()
    ];
  }

  // TODO merge other fields (permissions, computed fields, etc.) - not required by Hasura-auth yet
};

/**
 * Remove a table from a metadata object in-place
 */
export const removeTableMetadata = (
  metadata: HasuraMetadataV3,
  { name, schema }: QualifiedTable,
  source = 'default'
) => {
  const sourceObject = getSource(metadata, source);
  if (sourceObject.tables) {
    sourceObject.tables = sourceObject.tables.filter(
      (t) => !(t.table.name === name && t.table.schema === schema)
    );
  }
};

/**
 * Remove a relationship from a table in a metadata object in-place
 */
export const removeRelationship = (
  metadata: HasuraMetadataV3,
  { name, schema }: QualifiedTable,
  relationship: string,
  source = 'default'
) => {
  const sourceObject = getSource(metadata, source);

  const existingTable = sourceObject.tables?.find(
    (t) => t.table.name === name && t.table.schema === schema
  );
  if (existingTable) {
    if (existingTable.object_relationships) {
      existingTable.object_relationships =
        existingTable.object_relationships.filter(
          (r) => r.name !== relationship
        );
    }
    if (existingTable.array_relationships) {
      existingTable.array_relationships =
        existingTable.array_relationships.filter(
          (r) => r.name !== relationship
        );
    }
  }
};

function removeColumnConfig(
  metadata: HasuraMetadataV3,
  targetSource: string,
  targetTable: QualifiedTable,
  targetColumn: string
) {
  const sourceObject = getSource(metadata, targetSource);

  const existingTable = sourceObject.tables?.find(
    ({ table }) =>
      table.name === targetTable.name && table.schema === targetTable.schema
  );

  if (!existingTable || !existingTable.configuration) {
    return;
  }

  const existingConfiguration = existingTable.configuration;

  existingTable.configuration.column_config = Object.keys(
    existingConfiguration.column_config || {}
  ).reduce((config, currentKey) => {
    if (currentKey === targetColumn) {
      return config;
    }

    return {
      ...config,
      [currentKey]: existingConfiguration.column_config[currentKey],
    };
  }, {});

  existingTable.configuration.custom_column_names = Object.keys(
    existingConfiguration.custom_column_names || {}
  ).reduce((config, currentKey) => {
    if (currentKey === targetColumn) {
      return config;
    }

    return {
      ...config,
      [currentKey]: existingConfiguration.custom_column_names?.[currentKey],
    };
  }, {});
}

export interface MetadataPatch {
  additions?: {
    tables?: TableEntry[];
  };
  deletions?: {
    tables?: QualifiedTable[];
    relationships?: {
      table: QualifiedTable;
      relationship: string;
    }[];
    columnConfigs?: {
      source: string;
      table: QualifiedTable;
      column: string;
    }[];
  };
}

export const patchMetadataObject = (
  metadata: HasuraMetadataV3,
  { additions, deletions }: MetadataPatch
) => {
  if (additions?.tables) {
    for (const table of additions.tables) {
      patchTableObject(metadata, table);
    }
  }
  if (deletions?.tables) {
    for (const table of deletions.tables) {
      removeTableMetadata(metadata, table);
    }
  }
  if (deletions?.relationships) {
    for (const rel of deletions.relationships) {
      removeRelationship(metadata, rel.table, rel.relationship);
    }
  }

  if (deletions?.columnConfigs) {
    for (const config of deletions.columnConfigs) {
      removeColumnConfig(metadata, config.source, config.table, config.column);
    }
  }
};

export const patchMetadata = async (patch: MetadataPatch) => {
  logger.debug('Exporting metadata...');
  const metadata = await exportMetadata();

  patchMetadataObject(metadata, patch);
  logger.debug('Applying metadata patch...');
  await replaceMetadata(metadata);
};
