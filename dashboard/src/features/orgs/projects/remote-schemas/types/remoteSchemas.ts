export type EnvOrValueHeader =
  | {
      name: string;
      value: string;
      value_from_env: never;
    }
  | {
      name: string;
      value: never;
      value_from_env: string;
    };

export interface MetadataOperationOptions {
  appUrl: string;
  adminSecret: string;
}

export type RemoteSchemaRelationshipType = 'remote-schema' | 'database';
