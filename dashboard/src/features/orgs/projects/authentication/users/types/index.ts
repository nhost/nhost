import type { RemoteAppGetUsersAndAuthRolesQuery } from '@/generated/graphql';

export type RemoteAppUser = Exclude<
  RemoteAppGetUsersAndAuthRolesQuery['users'][0],
  '__typename'
>;
