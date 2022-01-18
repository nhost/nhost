import { Router } from 'express';

export default (router: Router) => {
  // THESE ENDPOINTS ARE ONLY TO BE USED FOR TESTS!!
  // They allows us to programmatically enable/disable
  // functionality needed for specific tests.

  const envStack: unknown[] = [];

  router.post('/change-env', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.boom.badRequest(
        'This endpoint is only available on test environments'
      );
    }

    envStack.push(Object.assign({}, process.env));

    Object.assign(process.env, req.body);

    res.json(process.env);
  });

  router.post('/reset-env', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.boom.badRequest(
        'This endpoint is only available on test environments'
      );
    }

    if (!envStack.length) {
      return res.boom.badRequest('No stored env');
    }

    Object.assign(process.env, envStack.pop());
    res.json(process.env);
  });

  router.get('/env/:id', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.boom.badRequest(
        'This endpoint is only available on test environments'
      );
    }

    res.send(process.env[req.params.id]);
  });
};
