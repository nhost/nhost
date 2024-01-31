import { faker } from '@faker-js/faker';
import type { NhostSession } from '@nhost/nextjs';
import { rest } from 'msw';

const tokenQuery = rest.post(
  `https://local.auth.nhost.run/v1/token`,
  (_req, res, ctx) =>
    res(
      ctx.json<NhostSession>({
        accessToken: faker.datatype.string(40),
        refreshToken: faker.datatype.uuid(),
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
          activeMfaType: null,
          metadata: {},
        },
      }),
    ),
);

export default tokenQuery;
