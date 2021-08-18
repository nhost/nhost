import express from 'express';
import helmet from 'helmet';
import { json } from 'body-parser';
import cors from 'cors';
import passport from 'passport';

import router from './routes';
import { errors } from './errors';
import { authMiddleware } from './middleware/auth';
import { pino } from './logger';

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(pino);
app.use(helmet());
app.use(json());
app.use(cors());

app.use(authMiddleware);

app.use(passport.initialize());

app.use(router);
app.use(errors);

export { app };
