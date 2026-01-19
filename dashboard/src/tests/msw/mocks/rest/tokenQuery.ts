import type { Session } from '@nhost/nhost-js/auth';
import { HttpResponse, http } from 'msw';
import { mockSession } from '@/tests/mocks';

const tokenQuery = http.post(
  'https://local.auth.local.nhost.run/v1/token',
  () => HttpResponse.json<Session>(mockSession),
);

export default tokenQuery;
