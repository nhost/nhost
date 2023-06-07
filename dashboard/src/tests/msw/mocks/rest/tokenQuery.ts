import { faker } from '@faker-js/faker';
import { rest } from 'msw';

const tokenQuery = rest.post(
  'https://local.auth.nhost.run/v1/token',
  async (_req, res, ctx) =>
    res(
      ctx.delay(250),
      ctx.json({
        accessToken: faker.random.alphaNumeric(50),
        accessTokenExpiresIn: 900,
        refreshToken: faker.datatype.uuid(),
        refreshTokenId: faker.datatype.uuid(),
        user: {
          id: faker.datatype.uuid(),
          createdAt: faker.datatype.datetime().toISOString(),
          displayName: faker.name.fullName(),
          avatarUrl: faker.image.avatar(),
          locale: 'en',
          email: faker.internet.email(),
          isAnonymous: false,
          defaultRole: 'user',
          metadata: null,
          emailVerified: false,
          phoneNumber: null,
          phoneNumberVerified: false,
          activeMfaType: null,
          roles: ['me', 'user'],
        },
      }),
    ),
);

export default tokenQuery;
