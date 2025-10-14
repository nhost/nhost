import { mockSession } from '@/tests/mocks';
import type { Session } from '@nhost/nhost-js/auth';
import { http, HttpResponse } from 'msw';

const tokenQuery = http.post(
  'https://local.auth.local.nhost.run/v1/token',
  () => HttpResponse.json<Session>(mockSession),
);

export default tokenQuery;
