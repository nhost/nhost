import axios from 'axios';
import { logger } from './logger';
import { ENV } from './utils/env';

/**
 * https://hasura.io/docs/latest/graphql/core/api-reference/schema-metadata-api/relationship.html
 * Here we are using the schema-metadata-api to track the relationships between auth tables
 **/

interface Table {
  name: string;
  schema: string;
}

interface TableArgs {
  source: string;
  table: Table;
  configuration?: {
    custom_name?: string;
    identifier?: string;
    custom_root_fields?: {
      select?: string;
      select_by_pk?: string;
      select_aggregate?: string;
      insert?: string;
      insert_one?: string;
      update?: string;
      update_by_pk?: string;
      delete?: string;
      delete_by_pk?: string;
    };
    custom_column_names?: {
      [key: string]: string;
    };
  };
}

interface RelationshipArgs {
  source: string;
  table: Table;
  name: string;
  using: {
    foreign_key_constraint_on:
      | {
          table: Table;
          columns: string[];
        }
      | string[];
  };
}

export const runMetadataRequest = async (args: any) => {
  await axios.post(
    ENV.HASURA_GRAPHQL_GRAPHQL_URL.replace('/v1/graphql', '/v1/metadata'),
    args,
    {
      headers: {
        'x-hasura-admin-secret': ENV.HASURA_GRAPHQL_ADMIN_SECRET,
      },
    }
  );
};

// https://hasura.io/docs/latest/graphql/core/api-reference/schema-metadata-api/table-view.html#track-table-v2
export const trackTable = async (args: TableArgs) => {
  try {
    await runMetadataRequest({
      type: 'pg_track_table',
      args,
    });
  } catch (error) {
    if (error.response.data.code !== 'already-tracked') {
      logger.error(error);
      throw new Error(`Error tracking table ${args.table.name}`);
    } else {
      logger.debug(`Table ${args.table.name} already tracked`);
    }
  }
};

export const setTableCustomization = async (args: TableArgs) => {
  logger.info(`Set table customization for ${args.table.name}`);

  try {
    await runMetadataRequest({
      type: 'pg_set_table_customization',
      args,
    });
  } catch (error) {
    logger.error(error);
    throw new Error('error setting customization for table ' + args.table.name);
  }
};

export const createObjectRelationship = async (args: RelationshipArgs) => {
  logger.info(`Set object relationship ${args.name} for ${args.table.name}`);
  try {
    await runMetadataRequest({
      type: 'pg_create_object_relationship',
      args,
    });
  } catch (error) {
    if (error.response.data.code !== 'already-exists') {
      throw new Error(
        `Error creating object relationship for table ${args.table.name}`
      );
    } else {
      logger.debug(
        `Object relationship ${args.name} on table ${args.table.name} is already created`
      );
    }
  }
};

export const createArrayRelationship = async (args: RelationshipArgs) => {
  logger.info(`create array relationship ${args.name} for ${args.table.name}`);
  try {
    await runMetadataRequest({
      type: 'pg_create_array_relationship',
      args,
    });
  } catch (error) {
    if (error.response.data.code !== 'already-exists') {
      throw new Error(
        `Error creating array relationship for table ${args.table.name}`
      );
    }
    logger.debug(
      `Array relationship ${args.name} on table ${args.table.name} is already created`
    );
  }
};

export const applyMetadata = async (): Promise<void> => {
  logger.info('Applying metadata');

  // track
  await trackTable({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'provider_requests',
    },
  });
  await trackTable({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'refresh_tokens',
    },
  });
  await trackTable({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'roles',
    },
  });
  await trackTable({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'user_providers',
    },
  });
  await trackTable({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'user_roles',
    },
  });
  await trackTable({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'users',
    },
  });
  await trackTable({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'providers',
    },
  });

  // customization
  await setTableCustomization({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'users',
    },
    configuration: {
      custom_name: 'users',
      custom_root_fields: {
        select: 'users',
        select_by_pk: 'user',
        select_aggregate: 'userAggregate',
        insert: 'insertUsers',
        insert_one: 'insertUser',
        update: 'updateUsers',
        update_by_pk: 'updateUser',
        delete: 'deleteUsers',
        delete_by_pk: 'deleteUser',
      },
      custom_column_names: {
        id: 'id',
        created_at: 'createdAt',
        updated_at: 'updatedAt',
        last_seen: 'lastSeen',
        disabled: 'disabled',
        display_name: 'displayName',
        avatar_url: 'avatarUrl',
        locale: 'locale',
        email: 'email',
        phone_number: 'phoneNumber',
        password_hash: 'passwordHash',
        email_verified: 'emailVerified',
        phone_number_verified: 'phoneNumberVerified',
        new_email: 'newEmail',
        otp_method_last_used: 'otpMethodLastUsed',
        otp_hash: 'otpHash',
        otp_hash_expires_at: 'otpHashExpiresAt',
        default_role: 'defaultRole',
        is_anonymous: 'isAnonymous',
        totp_secret: 'totpSecret',
        active_mfa_type: 'activeMfaType',
        ticket: 'ticket',
        ticket_expires_at: 'ticketExpiresAt',
      },
    },
  });

  await setTableCustomization({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'user_roles',
    },
    configuration: {
      custom_name: 'authUserRoles',
      custom_root_fields: {
        select: 'authUserRoles',
        select_by_pk: 'authUserRole',
        select_aggregate: 'authUserRolesAggregate',
        insert: 'insertAuthUserRoles',
        insert_one: 'insertAuthUserRole',
        update: 'updateAuthUserRoles',
        update_by_pk: 'updateAuthUserRole',
        delete: 'deleteAuthUserRoles',
        delete_by_pk: 'deleteAuthUserRole',
      },
      custom_column_names: {
        id: 'id',
        created_at: 'createdAt',
        user_id: 'userId',
        role: 'role',
      },
    },
  });
  await setTableCustomization({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'user_providers',
    },
    configuration: {
      custom_name: 'authUserProviders',
      custom_root_fields: {
        select: 'authUserProviders',
        select_by_pk: 'authUserProvider',
        select_aggregate: 'authUserProvidersAggregate',
        insert: 'insertAuthUserProviders',
        insert_one: 'insertAuthUserProvider',
        update: 'updateAuthUserProviders',
        update_by_pk: 'updateAuthUserProvider',
        delete: 'deleteAuthUserProviders',
        delete_by_pk: 'deleteAuthUserProvider',
      },
      custom_column_names: {
        id: 'id',
        created_at: 'createdAt',
        updated_at: 'updatedAt',
        user_id: 'userId',
        access_token: 'accessToken',
        refresh_token: 'refreshToken',
        provider_id: 'providerId',
        provider_user_id: 'providerUserId',
      },
    },
  });
  await setTableCustomization({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'providers',
    },
    configuration: {
      custom_name: 'authProviders',
      custom_root_fields: {
        select: 'authProviders',
        select_by_pk: 'authProvider',
        select_aggregate: 'authProvidersAggregate',
        insert: 'insertAuthProviders',
        insert_one: 'insertAuthProvider',
        update: 'updateAuthProviders',
        update_by_pk: 'updateAuthProvider',
        delete: 'deleteAuthProviders',
        delete_by_pk: 'deleteAuthProvider',
      },
      custom_column_names: {
        id: 'id',
      },
    },
  });
  await setTableCustomization({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'refresh_tokens',
    },
    configuration: {
      custom_name: 'authRefreshTokens',
      custom_root_fields: {
        select: 'authRefreshTokens',
        select_by_pk: 'authRefreshToken',
        select_aggregate: 'authRefreshTokensAggregate',
        insert: 'insertAuthRefreshTokens',
        insert_one: 'insertAuthRefreshToken',
        update: 'updateAuthRefreshTokens',
        update_by_pk: 'updateAuthRefreshToken',
        delete: 'deleteAuthRefreshTokens',
        delete_by_pk: 'deleteAuthRefreshToken',
      },
      custom_column_names: {
        refresh_token: 'refreshToken',
        created_at: 'createdAt',
        expires_at: 'expiresAt',
        user_id: 'userId',
      },
    },
  });
  await setTableCustomization({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'roles',
    },
    configuration: {
      custom_name: 'authRoles',
      custom_root_fields: {
        select: 'authRoles',
        select_by_pk: 'authRole',
        select_aggregate: 'authRolesAggregate',
        insert: 'insertAuthRoles',
        insert_one: 'insertAuthRole',
        update: 'updateAuthRoles',
        update_by_pk: 'updateAuthRole',
        delete: 'deleteAuthRoles',
        delete_by_pk: 'deleteAuthRole',
      },
      custom_column_names: {
        role: 'role',
      },
    },
  });
  await setTableCustomization({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'provider_requests',
    },
    configuration: {
      custom_name: 'authProviderRequests',
      custom_root_fields: {
        select: 'authProviderRequests',
        select_by_pk: 'authProviderRequest',
        select_aggregate: 'authProviderRequestsAggregate',
        insert: 'insertAuthProviderRequests',
        insert_one: 'insertAuthProviderRequest',
        update: 'updateAuthProviderRequests',
        update_by_pk: 'updateAuthProviderRequest',
        delete: 'deleteAuthProviderRequests',
        delete_by_pk: 'deleteAuthProviderRequest',
      },
      custom_column_names: {
        id: 'id',
        redirect_url: 'redirectUrl',
      },
    },
  });

  await createObjectRelationship({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'user_providers',
    },
    name: 'user',
    using: {
      foreign_key_constraint_on: ['user_id'],
    },
  });
  await createArrayRelationship({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'users',
    },
    name: 'userProviders',
    using: {
      foreign_key_constraint_on: {
        table: {
          schema: 'auth',
          name: 'user_providers',
        },
        columns: ['user_id'],
      },
    },
  });

  await createObjectRelationship({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'user_providers',
    },
    name: 'provider',
    using: {
      foreign_key_constraint_on: ['provider_id'],
    },
  });
  await createArrayRelationship({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'providers',
    },
    name: 'userProviders',
    using: {
      foreign_key_constraint_on: {
        table: {
          schema: 'auth',
          name: 'user_providers',
        },
        columns: ['provider_id'],
      },
    },
  });

  await createObjectRelationship({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'user_roles',
    },
    name: 'user',
    using: {
      foreign_key_constraint_on: ['user_id'],
    },
  });

  await createArrayRelationship({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'roles',
    },
    name: 'userRoles',
    using: {
      foreign_key_constraint_on: {
        table: {
          schema: 'auth',
          name: 'user_roles',
        },
        columns: ['role'],
      },
    },
  });

  await createObjectRelationship({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'users',
    },
    name: 'defaultRoleByRole',
    using: {
      foreign_key_constraint_on: ['default_role'],
    },
  });
  await createArrayRelationship({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'roles',
    },
    name: 'usersByDefaultRole',
    using: {
      foreign_key_constraint_on: {
        table: {
          schema: 'auth',
          name: 'users',
        },
        columns: ['default_role'],
      },
    },
  });

  await createArrayRelationship({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'users',
    },
    name: 'roles',
    using: {
      foreign_key_constraint_on: {
        table: {
          schema: 'auth',
          name: 'user_roles',
        },
        columns: ['user_id'],
      },
    },
  });

  await createObjectRelationship({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'user_roles',
    },
    name: 'user',
    using: {
      foreign_key_constraint_on: ['user_id'],
    },
  });

  await createObjectRelationship({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'user_roles',
    },
    name: 'roleByRole',
    using: {
      foreign_key_constraint_on: ['role'],
    },
  });

  await createObjectRelationship({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'refresh_tokens',
    },
    name: 'user',
    using: {
      foreign_key_constraint_on: ['user_id'],
    },
  });
  await createArrayRelationship({
    source: 'default',
    table: {
      schema: 'auth',
      name: 'users',
    },
    name: 'refreshTokens',
    using: {
      foreign_key_constraint_on: {
        table: {
          schema: 'auth',
          name: 'refresh_tokens',
        },
        columns: ['user_id'],
      },
    },
  });

  logger.debug('Done applying metadata');
};
