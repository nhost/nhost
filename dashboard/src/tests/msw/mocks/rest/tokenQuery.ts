import { mockSession } from '@/tests/mocks';
import type { Session } from '@nhost/nhost-js/auth';
import { rest } from 'msw';

const tokenQuery = rest.post(
  'https://local.auth.local.nhost.run/v1/token',
  (_req, res, ctx) => res(ctx.json<Session>(mockSession)),
);

export default tokenQuery;
