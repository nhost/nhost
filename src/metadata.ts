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
  table: Table;
  name: string;
  using: {
    foreign_key_constraint_on:
      | {
          table: Table;
          column: string;
        }
      | string;
  };
}

// https://hasura.io/docs/latest/graphql/core/api-reference/schema-metadata-api/table-view.html#track-table-v2
export const trackTable = async (args: TableArgs) => {
  logger.info(`Tracking table ${args.table.name}`);
  try {
    await axios.post(
      ENV.HASURA_GRAPHQL_GRAPHQL_URL.replace('/v1/graphql', '/v1/query'),
      {
        type: 'track_table',
        version: 2,
        args: args,
      },
      {
        headers: {
          'x-hasura-admin-secret': ENV.HASURA_GRAPHQL_ADMIN_SECRET,
        },
      }
    );
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
    await axios.post(
      ENV.HASURA_GRAPHQL_GRAPHQL_URL.replace('/v1/graphql', '/v1/query'),
      {
        type: 'set_table_customization',
        args: args,
      },
      {
        headers: {
          'x-hasura-admin-secret': ENV.HASURA_GRAPHQL_ADMIN_SECRET,
        },
      }
    );
  } catch (error) {
    logger.error(error);
    throw new Error('error setting customization for table ' + args.table.name);
  }
};

export const createObjectRelationship = async (args: RelationshipArgs) => {
  logger.info(`create object relationship ${args.name} for ${args.table.name}`);
  try {
    await axios.post(
      ENV.HASURA_GRAPHQL_GRAPHQL_URL.replace('/v1/graphql', '/v1/query'),
      {
        type: 'create_object_relationship',
        args,
      },
      {
        headers: {
          'x-hasura-admin-secret': ENV.HASURA_GRAPHQL_ADMIN_SECRET,
        },
      }
    );
  } catch (error) {
    if (error.response.data.code !== 'already-exists') {
      logger.error(error);
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
  // logger.info(`create array relationship ${args.name} for ${args.table.name}`);
  try {
    await axios.post(
      ENV.HASURA_GRAPHQL_GRAPHQL_URL.replace('/v1/graphql', '/v1/query'),
      {
        type: 'create_array_relationship',
        args,
      },
      {
        headers: {
          'x-hasura-admin-secret': ENV.HASURA_GRAPHQL_ADMIN_SECRET,
        },
      }
    );
  } catch (error) {
    if (error.response.data.code !== 'already-exists') {
      logger.error(error);
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
  logger.info('Applying metadata 3');

  // track tables
  await trackTable({ table: { schema: 'auth', name: 'users' } });
  await trackTable({ table: { schema: 'auth', name: 'user_roles' } });
  await trackTable({ table: { schema: 'auth', name: 'user_providers' } });
  await trackTable({ table: { schema: 'auth', name: 'providers' } });
  await trackTable({ table: { schema: 'auth', name: 'refresh_tokens' } });
  await trackTable({ table: { schema: 'auth', name: 'roles' } });
  await trackTable({ table: { schema: 'auth', name: 'provider_requests' } });
  await trackTable({ table: { schema: 'auth', name: 'migrations' } });

  // set custom root fields + custom column names
  await setTableCustomization({
    table: {
      schema: 'auth',
      name: 'users',
    },
    configuration: {
      custom_name: 'users',
      custom_root_fields: {
        select: 'users',
        select_by_pk: 'user',
        select_aggregate: 'UserAggregate',
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
        disabled: 'disabled',
        display_name: 'displayName',
        avatar_url: 'avatarUrl',
        locale: 'locale',
        email: 'email',
        phone_number: 'phoneNumber',
        password_hash: 'passwordHash',
        email_verified: 'emailVerified',
        last_verify_email_sent_at: 'lastVerifyEmailSentAt',
        phone_number_verified: 'phoneNumberVerified',
        last_verify_phone_number_sent_at: 'lastVerifyPhoneNumberSentAt',
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
    table: {
      schema: 'auth',
      name: 'roles',
    },
    configuration: {
      custom_name: 'authRoles',
      custom_root_fields: {
        select: 'AuthRoles',
        select_by_pk: 'AuthRole',
        select_aggregate: 'AuthRolesAggregate',
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
    table: {
      schema: 'auth',
      name: 'provider_requests',
    },
    configuration: {
      custom_name: 'authProviderRequests',
      custom_root_fields: {
        select: 'AuthProviderRequests',
        select_by_pk: 'AuthProviderRequest',
        select_aggregate: 'AuthProviderRequestsAggregate',
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
    table: {
      schema: 'auth',
      name: 'user_providers',
    },
    name: 'user',
    using: {
      foreign_key_constraint_on: 'user_id',
    },
  });
  await createArrayRelationship({
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
        column: 'user_id',
      },
    },
  });

  await createObjectRelationship({
    table: {
      schema: 'auth',
      name: 'user_providers',
    },
    name: 'provider',
    using: {
      foreign_key_constraint_on: 'provider_id',
    },
  });
  await createArrayRelationship({
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
        column: 'provider_id',
      },
    },
  });

  await createObjectRelationship({
    table: {
      schema: 'auth',
      name: 'user_roles',
    },
    name: 'user',
    using: {
      foreign_key_constraint_on: 'user_id',
    },
  });
  await createArrayRelationship({
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
        column: 'user_id',
      },
    },
  });

  await createObjectRelationship({
    table: {
      schema: 'auth',
      name: 'user_roles',
    },
    name: 'user',
    using: {
      foreign_key_constraint_on: 'user_id',
    },
  });

  await createObjectRelationship({
    table: {
      schema: 'auth',
      name: 'refresh_tokens',
    },
    name: 'user',
    using: {
      foreign_key_constraint_on: 'user_id',
    },
  });
  await createArrayRelationship({
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
        column: 'user_id',
      },
    },
  });

  // try to add relation from `public.profiles` to `auth.users`
  // the `public.profile` table is optional.
  // Which is why we allow this to fail silently.
  try {
    await createObjectRelationship({
      table: {
        schema: 'public',
        name: 'profiles',
      },
      name: 'user',
      using: {
        foreign_key_constraint_on: 'user_id',
      },
    });

    await createObjectRelationship({
      table: {
        schema: 'auth',
        name: 'users',
      },
      name: 'profile',
      using: {
        foreign_key_constraint_on: {
          table: {
            schema: 'public',
            name: 'profiles',
          },
          column: 'user_id',
        },
      },
    });
  } catch (error) {
    logger.debug(
      'Unable to add relationship between public.profiles and auth.users'
    );
  }

  // console.log('Finished applying metadata');
};
