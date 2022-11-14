import { Router } from 'express';

import apple from './apple';

const router = Router();

apple(router);

export default (parentRouter: Router) => {
  parentRouter.use('/signin/provider', router);
};
