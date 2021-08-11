import express from 'express';
import helmet from 'helmet';
import { json } from 'body-parser';
import cors from 'cors';
import passport from 'passport';
import morgan from 'morgan';
import morganBody from 'morgan-body';

import router from './routes';
import { errors } from './errors';
import { authMiddleware } from './middleware/auth';
// import logger from './logger';

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// app.use(morgan('combined'))
app.use(
  morgan(
    ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length]'
  )
);
// app.use((req, res, next) => {
//   req.logger = logger;
//   return next();
// });

app.use(helmet());
app.use(json());
app.use(cors({ credentials: true, origin: true }));

if (process.env.CI || process.env.NODE_ENV === 'development') {
  morganBody(app, {
    skip: (req) => {
      return req.originalUrl === '/change-env';
    },
  });
}

app.use(authMiddleware);

app.use(passport.initialize());

app.use(router);
app.use(errors);

export { app };
