import { HttpResponse } from 'msw';
import nhostGraphQLLink from './nhostGraphQLLink';

export default nhostGraphQLLink.mutation('UpdateConfig', () =>
  HttpResponse.json({
    data: {
      updateConfig: {
        id: 'ConfigConfig',
      },
    },
  }),
);
