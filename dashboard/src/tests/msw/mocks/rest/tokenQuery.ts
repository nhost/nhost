import { faker } from '@faker-js/faker';
import type { Session } from '@nhost/nhost-js-beta/auth';
import { rest } from 'msw';

const tokenQuery = rest.post(
  `https://local.auth.local.nhost.run/v1/token`,
  (_req, res, ctx) =>
    res(
      ctx.json<Session>({
        accessToken: faker.datatype.string(40),
        refreshToken: faker.datatype.uuid(),
        refreshTokenId: faker.datatype.uuid(),
        accessTokenExpiresIn: 900,
        user: {
          id: faker.datatype.uuid(),
          createdAt: faker.date.past().toUTCString(),
          displayName: `${faker.name.firstName()} ${faker.name.lastName()}`,
          avatarUrl: faker.internet.avatar(),
          locale: 'en',
          isAnonymous: false,
          emailVerified: true,
          defaultRole: 'user',
          roles: ['user', 'me'],
          phoneNumber: null,
          phoneNumberVerified: false,
          metadata: {},
        },
      }),
    ),
);

export default tokenQuery;
