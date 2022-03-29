import { Router } from 'express';
import { sendError } from '@/errors';

export default (router: Router) => {
  // THESE ENDPOINTS ARE ONLY TO BE USED FOR TESTS!!
  // They allows us to programmatically enable/disable
  // functionality needed for specific tests.

  const envStack: unknown[] = [];

  router.post('/change-env', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return sendError(res, 'forbidden-endpoint-in-production');
    }

    envStack.push(Object.assign({}, process.env));

    Object.assign(process.env, req.body);

    res.json(process.env);
  });

  router.get('/env/:id', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return sendError(res, 'forbidden-endpoint-in-production');
    }

    res.send(process.env[req.params.id]);
  });
};
