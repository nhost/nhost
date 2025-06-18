export interface HasuraRemoteSchemaDefinition {
  role: string;
  permission: Partial<{
    columns: string[];
    filter: Record<string, any>;
    check: Record<string, any>;
    limit: number;
    allow_aggregations: boolean;
    query_root_fields: string[];
    subscription_root_fields: string[];
    computed_fields: string[];
    set: Record<string, any>;
    backend_only: boolean;
  }>;
}

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
